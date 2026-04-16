"""Select the best segments for the highlight reel from scored candidates.

Upgraded with narrative-aware selection:
- Temporal spread enforcement (beginning, middle, end)
- Pacing variety (mix of intense and building moments)
- Cluster prevention (no more than 40% from any third of the video)
"""

from __future__ import annotations

import logging
from dataclasses import dataclass

from pipeline.segment_scoring import ScoredSegment

logger = logging.getLogger(__name__)

WEIGHT_GEMINI = 0.5
WEIGHT_VIDEO_INTEL = 0.25
WEIGHT_AUDIO = 0.25

MIN_GAP_BETWEEN_ADJACENT = 1.0
MAX_CLUSTER_RATIO = 0.4


@dataclass
class SelectedSegment:
    start_time: float
    end_time: float
    duration: float
    score: float
    label: str
    pacing: str = "intense"


def _composite_score(seg: ScoredSegment) -> float:
    return (
        WEIGHT_GEMINI * seg.gemini_score
        + WEIGHT_VIDEO_INTEL * seg.video_intel_score
        + WEIGHT_AUDIO * seg.audio_score
    )


def _overlaps(seg: ScoredSegment, selected: list[SelectedSegment]) -> bool:
    for s in selected:
        if seg.start_time < s.end_time + MIN_GAP_BETWEEN_ADJACENT and seg.end_time > s.start_time - MIN_GAP_BETWEEN_ADJACENT:
            return True
    return False


def _third_durations(selected: list[SelectedSegment], video_duration: float) -> tuple[float, float, float]:
    """Compute how much selected duration falls in each third of the video."""
    t1 = video_duration / 3
    t2 = 2 * video_duration / 3
    d1 = d2 = d3 = 0.0
    for s in selected:
        mid = (s.start_time + s.end_time) / 2
        if mid < t1:
            d1 += s.duration
        elif mid < t2:
            d2 += s.duration
        else:
            d3 += s.duration
    return d1, d2, d3


def _exceeds_cluster_limit(
    seg: ScoredSegment,
    selected: list[SelectedSegment],
    video_duration: float,
    total_selected_duration: float,
) -> bool:
    """Check if adding this segment would concentrate too much in one third."""
    t1 = video_duration / 3
    t2 = 2 * video_duration / 3
    mid = (seg.start_time + seg.end_time) / 2

    d1, d2, d3 = _third_durations(selected, video_duration)
    projected_total = total_selected_duration + seg.duration

    if projected_total <= 0:
        return False

    if mid < t1:
        d1 += seg.duration
    elif mid < t2:
        d2 += seg.duration
    else:
        d3 += seg.duration

    return max(d1, d2, d3) / projected_total > MAX_CLUSTER_RATIO


def select_highlights(
    segments: list[ScoredSegment],
    target_duration: float,
    video_duration: float,
    boost_diversity: bool = False,
) -> list[SelectedSegment]:
    """Select segments to fill the target duration with narrative awareness.

    Two-pass approach:
    1. Greedy pass: pick top-scoring non-overlapping segments with cluster prevention.
    2. Fill pass: if still short, relax constraints and add more segments.

    When boost_diversity is True (used on quality-review retry), the cluster
    limit is tightened and pacing variety is enforced more aggressively.
    """
    cluster_limit = 0.3 if boost_diversity else MAX_CLUSTER_RATIO

    ranked = sorted(segments, key=_composite_score, reverse=True)

    selected: list[SelectedSegment] = []
    total_duration = 0.0

    for seg in ranked:
        if total_duration >= target_duration:
            break

        if _overlaps(seg, selected):
            continue

        if len(selected) >= 2 and _exceeds_cluster_limit(seg, selected, video_duration, total_duration):
            continue

        if boost_diversity and len(selected) >= 2:
            recent_pacings = [s.pacing for s in selected[-2:]]
            if seg.pacing in recent_pacings and seg.pacing == recent_pacings[-1]:
                lower_ranked = [
                    s for s in ranked
                    if s.pacing != seg.pacing
                    and not _overlaps(s, selected)
                    and _composite_score(s) >= _composite_score(seg) * 0.7
                ]
                if lower_ranked:
                    continue

        remaining = target_duration - total_duration
        start = seg.start_time
        end = seg.end_time
        duration = seg.duration

        if duration > remaining and remaining >= 5.0:
            mid = (start + end) / 2.0
            half = remaining / 2.0
            start = max(seg.start_time, mid - half)
            end = min(seg.end_time, mid + half)
            duration = end - start

        selected.append(SelectedSegment(
            start_time=start,
            end_time=end,
            duration=duration,
            score=_composite_score(seg),
            label=seg.label,
            pacing=getattr(seg, "pacing", "intense"),
        ))
        total_duration += duration

    if total_duration < target_duration * 0.5 and len(ranked) > len(selected):
        logger.info("Fill pass: only %.1fs selected so far, adding more segments", total_duration)
        for seg in ranked:
            if total_duration >= target_duration:
                break

            already = any(
                abs(s.start_time - seg.start_time) < 0.5 for s in selected
            )
            if already:
                continue

            remaining = target_duration - total_duration
            start = seg.start_time
            end = seg.end_time
            duration = seg.duration

            if duration > remaining and remaining >= 3.0:
                start = seg.start_time
                end = min(seg.end_time, start + remaining)
                duration = end - start

            if duration > remaining:
                continue

            selected.append(SelectedSegment(
                start_time=start,
                end_time=end,
                duration=duration,
                score=_composite_score(seg),
                label=seg.label,
                pacing=getattr(seg, "pacing", "intense"),
            ))
            total_duration += duration

    selected.sort(key=lambda s: s.start_time)

    logger.info(
        "Selected %d segments (%.1fs) from %d candidates for %.0fs target",
        len(selected), total_duration, len(segments), target_duration,
    )
    return selected
