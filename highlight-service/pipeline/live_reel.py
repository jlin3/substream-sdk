"""Build a highlight reel from annotations accumulated during a live stream.

The original pipeline could only start selecting once a finished file existed.
Here the dense annotation already happened while the stream was running, so at
stream end the only remaining work is choosing spans and running ffmpeg. That is
what makes the reel available within seconds of the stream stopping.

Three things this does that a score-ranked cut does not:

  Protected chains. A causal chain — collision causes knockback causes
  elimination — is meaningless truncated halfway. Segments the arbiter marked as
  protected get expanded to cover the whole chain rather than clipped to fit.

  Spoiler ordering. A segment that reveals the match outcome ruins the segments
  after it. High spoiler-risk spans are demoted to the end of the reel instead
  of appearing in chronological position.

  Temporal spread. Reels drawn only from the best-scoring window cluster all
  look the same. Selection caps how much of the reel any one third of the stream
  can contribute.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass
from typing import Optional

from pipeline.highlight_selection import SelectedSegment
from schemas.world_annotation import DenseWindow, NarrativeSegment

logger = logging.getLogger(__name__)

# Weights blending the arbiter's two judgements. Shareability carries real weight
# because a technically impressive moment that nobody would clip is not a
# highlight.
WEIGHT_SCORE = 0.6
WEIGHT_SHAREABILITY = 0.4

MIN_GAP_BETWEEN_SEGMENTS = 1.0
MAX_CLUSTER_RATIO = 0.5
MIN_SEGMENT_DURATION = 1.5
MAX_SEGMENT_DURATION = 20.0
SPOILER_DEMOTION_THRESHOLD = 60


@dataclass
class ReelPlan:
    """The chosen segments plus the reasoning, so the UI can explain itself."""

    segments: list[SelectedSegment]
    total_duration: float
    rejected: list[dict]
    spoilers_demoted: int
    chains_protected: int

    def as_dict(self) -> dict:
        return {
            "segments": [
                {
                    "start_time": round(s.start_time, 2),
                    "end_time": round(s.end_time, 2),
                    "duration": round(s.duration, 2),
                    "score": round(s.score, 1),
                    "label": s.label,
                    "pacing": s.pacing,
                }
                for s in self.segments
            ],
            "total_duration": round(self.total_duration, 2),
            "segment_count": len(self.segments),
            "rejected": self.rejected,
            "spoilers_demoted": self.spoilers_demoted,
            "chains_protected": self.chains_protected,
        }


def blended_score(segment: NarrativeSegment) -> float:
    return WEIGHT_SCORE * segment.score + WEIGHT_SHAREABILITY * segment.shareability


def expand_protected_chain(
    segment: NarrativeSegment,
    windows: list[DenseWindow],
    max_expansion: float = 6.0,
) -> tuple[float, float]:
    """Widen a segment so a causal chain inside it is not cut apart.

    Walks the `cause_event_id` links of events inside the segment out to the
    events that caused them, and extends the bounds to include those causes.
    Capped, because an unbounded chain walk can swallow the whole stream.
    """
    if not segment.protected_chain:
        return segment.t_start, segment.t_end

    events_by_id = {e.event_id: e for w in windows for e in w.events if e.event_id}
    inside = [
        e
        for w in windows
        for e in w.events
        if segment.t_start <= e.t <= segment.t_end
    ]

    t_start, t_end = segment.t_start, segment.t_end
    seen: set[str] = set()
    frontier = [e for e in inside if e.cause_event_id]
    while frontier:
        event = frontier.pop()
        if event.event_id in seen:
            continue
        seen.add(event.event_id)
        cause = events_by_id.get(event.cause_event_id)
        if cause is None:
            continue
        # Include the cause, plus a little lead-in so it is legible on screen.
        candidate_start = min(t_start, cause.t - 1.0)
        if segment.t_start - candidate_start <= max_expansion:
            t_start = candidate_start
        if cause.cause_event_id:
            frontier.append(cause)

    return max(0.0, t_start), t_end


def select_reel_segments(
    segments: list[NarrativeSegment],
    windows: list[DenseWindow],
    target_duration: float = 90.0,
    stream_duration: Optional[float] = None,
    min_score: float = 40.0,
) -> ReelPlan:
    """Choose and order the segments that make up the reel."""
    if not segments:
        return ReelPlan([], 0.0, [], 0, 0)

    duration = stream_duration or max(s.t_end for s in segments)
    ranked = sorted(segments, key=blended_score, reverse=True)

    chosen: list[tuple[NarrativeSegment, float, float]] = []
    rejected: list[dict] = []
    total = 0.0
    chains_protected = 0

    for segment in ranked:
        score = blended_score(segment)
        if score < min_score:
            rejected.append(
                {"t_start": segment.t_start, "reason": f"score {score:.0f} below floor"}
            )
            continue

        t_start, t_end = expand_protected_chain(segment, windows)
        if (t_start, t_end) != (segment.t_start, segment.t_end):
            chains_protected += 1

        span = t_end - t_start
        if span < MIN_SEGMENT_DURATION:
            rejected.append(
                {"t_start": segment.t_start, "reason": f"too short ({span:.1f}s)"}
            )
            continue
        if span > MAX_SEGMENT_DURATION:
            # Keep the end, where the payoff almost always is.
            t_start = t_end - MAX_SEGMENT_DURATION
            span = MAX_SEGMENT_DURATION

        if _overlaps(t_start, t_end, chosen):
            rejected.append(
                {"t_start": segment.t_start, "reason": "overlaps a better segment"}
            )
            continue

        if total + span > target_duration:
            rejected.append(
                {"t_start": segment.t_start, "reason": "would exceed target duration"}
            )
            continue

        if _would_cluster(t_start, t_end, chosen, duration, target_duration):
            rejected.append(
                {"t_start": segment.t_start, "reason": "over-represents one part of the stream"}
            )
            continue

        chosen.append((segment, t_start, t_end))
        total += span

    ordered = _order_for_playback(chosen)
    spoilers_demoted = sum(
        1 for seg, _, _ in chosen if seg.spoiler_risk >= SPOILER_DEMOTION_THRESHOLD
    )

    selected = [
        SelectedSegment(
            start_time=t_start,
            end_time=t_end,
            duration=t_end - t_start,
            score=blended_score(segment),
            label=segment.label or segment.narrative_role.value,
            pacing=segment.pacing.value,
        )
        for segment, t_start, t_end in ordered
    ]

    logger.info(
        "Reel plan: %d segments, %.1fs total, %d chains protected, %d spoilers demoted",
        len(selected),
        total,
        chains_protected,
        spoilers_demoted,
    )
    return ReelPlan(
        segments=selected,
        total_duration=total,
        rejected=rejected,
        spoilers_demoted=spoilers_demoted,
        chains_protected=chains_protected,
    )


def _overlaps(
    t_start: float, t_end: float, chosen: list[tuple[NarrativeSegment, float, float]]
) -> bool:
    for _, s, e in chosen:
        if t_start < e + MIN_GAP_BETWEEN_SEGMENTS and t_end > s - MIN_GAP_BETWEEN_SEGMENTS:
            return True
    return False


def _would_cluster(
    t_start: float,
    t_end: float,
    chosen: list[tuple[NarrativeSegment, float, float]],
    stream_duration: float,
    target_duration: float,
) -> bool:
    """Reject a segment that would over-concentrate the reel in one third.

    Skipped while the reel is nearly empty, since the constraint is meaningless
    before there is anything to balance against and would otherwise reject the
    single best moment for being alone.
    """
    if stream_duration <= 0 or len(chosen) < 2:
        return False
    third = stream_duration / 3
    bucket = min(2, int(t_start / third))
    in_bucket = (t_end - t_start) + sum(
        e - s for _, s, e in chosen if min(2, int(s / third)) == bucket
    )
    return in_bucket > target_duration * MAX_CLUSTER_RATIO


def _order_for_playback(
    chosen: list[tuple[NarrativeSegment, float, float]],
) -> list[tuple[NarrativeSegment, float, float]]:
    """Chronological, except that spoilers are moved to the end."""
    safe = [c for c in chosen if c[0].spoiler_risk < SPOILER_DEMOTION_THRESHOLD]
    spoilers = [c for c in chosen if c[0].spoiler_risk >= SPOILER_DEMOTION_THRESHOLD]
    safe.sort(key=lambda c: c[1])
    spoilers.sort(key=lambda c: c[1])
    return safe + spoilers


def build_reel(
    source_path: str,
    segments: list[NarrativeSegment],
    windows: list[DenseWindow],
    output_path: str,
    work_dir: str,
    target_duration: float = 90.0,
    stream_duration: Optional[float] = None,
    preset: str = "standard",
) -> dict:
    """Select spans and assemble the reel. Returns the plan plus the output path."""
    from pipeline.assembly import assemble_highlight_reel

    plan = select_reel_segments(
        segments,
        windows,
        target_duration=target_duration,
        stream_duration=stream_duration,
    )
    if not plan.segments:
        raise ValueError("No segments cleared selection; nothing to assemble")

    assemble_highlight_reel(
        source_path, plan.segments, output_path, work_dir, preset=preset
    )
    result = plan.as_dict()
    result["output_path"] = output_path
    return result
