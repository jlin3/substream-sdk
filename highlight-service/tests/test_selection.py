"""Tests for highlight selection logic."""

from pipeline.highlight_selection import select_highlights, SelectedSegment
from pipeline.segment_scoring import ScoredSegment


def _make_segment(start: float, end: float, gemini: float = 70, vi: float = 60, audio: float = 50, label: str = "action") -> ScoredSegment:
    return ScoredSegment(
        start_time=start,
        end_time=end,
        duration=end - start,
        gemini_score=gemini,
        video_intel_score=vi,
        audio_score=audio,
        label=label,
    )


def test_selects_highest_scoring():
    segments = [
        _make_segment(0, 10, gemini=90),
        _make_segment(15, 25, gemini=30),
        _make_segment(30, 40, gemini=80),
    ]
    selected = select_highlights(segments, target_duration=20, video_duration=40)
    assert len(selected) == 2
    assert selected[0].start_time == 0
    assert selected[1].start_time == 30


def test_respects_target_duration():
    segments = [
        _make_segment(0, 10, gemini=90),
        _make_segment(15, 25, gemini=85),
        _make_segment(30, 40, gemini=80),
        _make_segment(45, 55, gemini=75),
    ]
    selected = select_highlights(segments, target_duration=20, video_duration=55)
    total = sum(s.duration for s in selected)
    assert total <= 25


def test_enforces_minimum_gap():
    segments = [
        _make_segment(0, 5, gemini=90),
        _make_segment(6, 11, gemini=85),
        _make_segment(20, 25, gemini=80),
    ]
    selected = select_highlights(segments, target_duration=30, video_duration=25)
    for i in range(1, len(selected)):
        gap = selected[i].start_time - selected[i - 1].end_time
        assert gap >= 3.0 or selected[i].start_time >= selected[i - 1].end_time


def test_empty_segments():
    selected = select_highlights([], target_duration=90, video_duration=100)
    assert selected == []


def test_returns_chronological_order():
    segments = [
        _make_segment(50, 60, gemini=95),
        _make_segment(0, 10, gemini=90),
        _make_segment(25, 35, gemini=85),
    ]
    selected = select_highlights(segments, target_duration=30, video_duration=60)
    times = [s.start_time for s in selected]
    assert times == sorted(times)
