"""Select the best segments for the highlight reel from scored candidates."""

from __future__ import annotations

import logging
from dataclasses import dataclass

from pipeline.segment_scoring import ScoredSegment

logger = logging.getLogger(__name__)

WEIGHT_GEMINI = 0.5
WEIGHT_VIDEO_INTEL = 0.25
WEIGHT_AUDIO = 0.25

MIN_GAP_BETWEEN_ADJACENT = 1.0

MAX_CLUSTER_RATIO = 0.6


@dataclass
class SelectedSegment:
    start_time: float
    end_time: float
    duration: float
    score: float
    label: str


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


def select_highlights(
    segments: list[ScoredSegment],
    target_duration: float,
    video_duration: float,
) -> list[SelectedSegment]:
    """Select segments to fill the target duration.

    Two-pass approach:
    1. Greedy pass: pick top-scoring non-overlapping segments until target is met.
    2. Fill pass: if still short, relax constraints and add more segments.
    """
    ranked = sorted(segments, key=_composite_score, reverse=True)

    selected: list[SelectedSegment] = []
    total_duration = 0.0

    for seg in ranked:
        if total_duration >= target_duration:
            break

        if _overlaps(seg, selected):
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
            ))
            total_duration += duration

    selected.sort(key=lambda s: s.start_time)

    logger.info(
        "Selected %d segments (%.1fs) from %d candidates for %.0fs target",
        len(selected), total_duration, len(segments), target_duration,
    )
    return selected
