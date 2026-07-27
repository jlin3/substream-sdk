"""End-to-end tests for the live annotation path.

These stub the model call rather than the pipeline, so windowing, pacing,
fan-out, cost metering and reel assembly all run for real against real video
files cut by real ffmpeg. That is the part worth testing: the model returning
plausible JSON is a given, and everything around it is where alignment and
timing bugs actually live.
"""

from __future__ import annotations

import asyncio
import os
import subprocess
import sys
import tempfile

import pytest

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import config  # noqa: E402
from pipeline import annotator as annotator_mod  # noqa: E402
from pipeline.annotator import (  # noqa: E402
    StreamAnnotator,
    WindowClip,
    plan_windows,
    probe_duration,
    select_candidate_spans,
)
from pipeline.live_session import LiveSession, RingBuffer, SessionRegistry  # noqa: E402
from pipeline.pacer import WallClockPacer  # noqa: E402
from schemas.world_annotation import DenseWindow, EventType  # noqa: E402
from services.genai_client import UsageMeter, estimate_cost  # noqa: E402


def make_test_video(path: str, duration: int = 24, fps: int = 30) -> str:
    """Render a synthetic clip with motion and a tone."""
    subprocess.run(
        [
            "ffmpeg", "-y", "-loglevel", "error",
            "-f", "lavfi", "-i", f"testsrc=size=640x360:rate={fps}:duration={duration}",
            "-f", "lavfi", "-i", f"sine=frequency=440:duration={duration}",
            "-c:v", "libx264", "-preset", "ultrafast", "-pix_fmt", "yuv420p",
            "-c:a", "aac", "-shortest", path,
        ],
        check=True,
        capture_output=True,
        timeout=120,
    )
    return path


@pytest.fixture(scope="module")
def test_video():
    tmpdir = tempfile.mkdtemp(prefix="substream_test_")
    path = os.path.join(tmpdir, "source.mp4")
    make_test_video(path, duration=24)
    yield path


@pytest.fixture
def stub_models(monkeypatch):
    """Replace the three model tiers with deterministic local stubs."""
    calls = {"triage": 0, "dense": 0, "arbiter": 0, "identify": 0}

    def fake_identify(clip, meter, hint=None):
        calls["identify"] += 1
        return {
            "game_title": hint or "Stumble Guys",
            "genre": "party_battle_royale",
            "perspective": "third_person_close",
            "contains_real_world_video": False,
            "notes": "stub",
        }

    def fake_triage(clip, genre, meter):
        calls["triage"] += 1
        # Make the middle of the stream interesting and the edges dull, so the
        # threshold actually gets exercised in both directions.
        interesting = 8.0 <= clip.t_start < 20.0
        meter.record(_rec("gemini-3.5-flash-lite", "triage", 1000, 100))
        return {
            "salience": 85 if interesting else 5,
            "reason": "stub",
            "likely_events": ["knockback"] if interesting else [],
            "is_gameplay": True,
        }

    def fake_annotate(clip, genre, game_title, rolling_context, meter):
        calls["dense"] += 1
        meter.record(_rec("gemini-3.6-flash", "dense_annotation", 3000, 1400))
        from schemas.world_annotation import parse_dense_window

        mid = clip.t_start + (clip.t_end - clip.t_start) / 2
        payload = {
            "camera": {
                "perspective": "third_person_close",
                "motion": "follow",
                "motion_magnitude": 60,
                "shake": 40,
                "cut_detected": False,
            },
            "agent": {
                "action_category": "locomotion",
                "action": "jump",
                "secondary_action": "run",
                "movement_mode": "airborne",
                "intent": "cross the gap",
                "control_confidence": 88,
            },
            "entities": [
                {"entity_id": "e1", "role": "obstacle", "label": "spinning bar", "salience": 75}
            ],
            "events": [
                {
                    "event_id": "ev1",
                    "event_type": "collision",
                    "t": mid,
                    "outcome": "failure",
                    "magnitude": 65,
                    "subject_entity_id": "player",
                    "object_entity_id": "e1",
                    "cause_event_id": "",
                    "note": "hit by bar",
                },
                {
                    "event_id": "ev2",
                    "event_type": "knockback",
                    "t": mid + 0.4,
                    "outcome": "failure",
                    "magnitude": 80,
                    "subject_entity_id": "player",
                    "object_entity_id": "",
                    "cause_event_id": "ev1",
                    "note": "launched",
                },
            ],
            "physics": ["collision", "ragdoll"],
            "affordances": ["jump", "run"],
            "ui_state": {"players_remaining": 14, "raw_text": ["14 LEFT"]},
            "reward_signal": -0.7,
            "scene_caption": f"player knocked off course at {mid:.0f}s",
            "uncertainty": {
                "camera": 90, "agent": 85, "entities": 70, "events": 80, "ui_state": 60
            },
        }
        return parse_dense_window(
            payload, f"w{clip.index:05d}", clip.t_start, clip.t_end
        )

    def fake_score(clip, genre, game_title, window_context, meter):
        calls["arbiter"] += 1
        meter.record(_rec("gemini-3.1-pro-preview", "narrative_arbiter", 8000, 600))
        from schemas.world_annotation import NarrativeSegment

        return NarrativeSegment(
            segment_id=f"s{clip.index:05d}",
            t_start=clip.t_start,
            t_end=clip.t_end,
            score=82.0,
            label="wipeout",
            reason="stub",
            pacing="climactic",
            narrative_role="climax",
            shareability=90,
            emotional_valence="funny",
            spoiler_risk=10,
            protected_chain=True,
        )

    monkeypatch.setattr(annotator_mod, "identify_episode", fake_identify)
    monkeypatch.setattr(annotator_mod, "triage_window", fake_triage)
    monkeypatch.setattr(annotator_mod, "annotate_window", fake_annotate)
    monkeypatch.setattr(annotator_mod, "score_segment", fake_score)
    return calls


def _rec(model, purpose, in_tok, out_tok):
    from services.genai_client import CallRecord

    return CallRecord(
        model=model,
        purpose=purpose,
        input_tokens=in_tok,
        output_tokens=out_tok,
        cached_tokens=0,
        cost_usd=estimate_cost(model, in_tok, out_tok),
        latency_ms=12.0,
    )


# -- windowing ----------------------------------------------------------


def test_plan_windows_covers_full_duration():
    spans = plan_windows(60, 8, 4)
    assert spans[0] == (0.0, 8.0)
    assert spans[-1][1] == 60
    # Overlap means consecutive windows share half their length.
    assert spans[1][0] == 4.0


def test_plan_windows_folds_trailing_sliver():
    spans = plan_windows(9, 8, 4)
    # A 1s tail must not become its own window.
    assert all(end - start >= 3 for start, end in spans)
    assert spans[-1][1] == 9


def test_plan_windows_handles_degenerate_input():
    assert plan_windows(0, 8, 4) == []
    assert plan_windows(-5, 8, 4) == []
    assert len(plan_windows(3, 8, 4)) == 1


# -- ring buffer --------------------------------------------------------


def test_ring_buffer_bounds_memory():
    ring = RingBuffer(max_bytes=1000)
    for _ in range(10):
        ring.append(b"x" * 300)
    assert ring.size <= 1000
    assert ring.dropped_bytes > 0


def test_ring_buffer_drain_returns_all_retained():
    ring = RingBuffer(max_bytes=10_000)
    ring.append(b"abc")
    ring.append(b"def")
    assert ring.drain() == b"abcdef"
    assert ring.size == 0


# -- cost metering ------------------------------------------------------


def test_tiered_annotation_is_cheaper_than_flat():
    """The tiered design must actually beat annotating everything densely."""
    dense_in, dense_out = 8 * 102 + 2000, 1400
    triage_in, triage_out = 4 * 102 + 600, 200
    flat_hour = estimate_cost("gemini-3.6-flash", dense_in, dense_out) * 450
    tiered_hour = (
        estimate_cost("gemini-3.5-flash-lite", triage_in, triage_out) * 900
        + estimate_cost("gemini-3.6-flash", dense_in, dense_out) * 450 * 0.25
    )
    assert tiered_hour < flat_hour / 2


def test_long_context_tier_step_applies():
    short = estimate_cost("gemini-3.1-pro-preview", 150_000, 10_000)
    long = estimate_cost("gemini-3.1-pro-preview", 250_000, 10_000)
    # Above the threshold every token reprices, so cost more than scales.
    assert long / short > 250_000 / 150_000


def test_meter_summary_groups_by_model_and_purpose():
    meter = UsageMeter()
    meter.record(_rec("gemini-3.6-flash", "dense_annotation", 1000, 500))
    meter.record(_rec("gemini-3.6-flash", "dense_annotation", 1000, 500))
    meter.record(_rec("gemini-3.5-flash-lite", "triage", 500, 100))
    summary = meter.summary()
    assert summary["calls"] == 3
    assert summary["by_model"]["gemini-3.6-flash"]["calls"] == 2
    assert summary["by_purpose"]["triage"]["calls"] == 1
    assert summary["cost_usd"] > 0


# -- annotation over real video ----------------------------------------


@pytest.mark.asyncio
async def test_stream_annotator_skips_dull_windows(test_video, stub_models):
    session = LiveSession(game_title="Stumble Guys", window_seconds=8, overlap_seconds=4)
    await session.attach_source(test_video)
    try:
        await session.mark_ended()
        await session.drain(timeout=120)
        state = session.annotator.state
        # Triage saw everything; dense only ran on the interesting middle.
        assert state.triaged > 0
        assert state.skipped > 0
        assert len(state.windows) > 0
        assert len(state.windows) < state.triaged
        assert stub_models["identify"] == 1
    finally:
        await session.close()


@pytest.mark.asyncio
async def test_event_timestamps_stay_inside_their_window(test_video, stub_models):
    session = LiveSession(game_title="Stumble Guys", window_seconds=8, overlap_seconds=4)
    await session.attach_source(test_video)
    try:
        await session.mark_ended()
        await session.drain(timeout=120)
        for window in session.annotator.state.windows:
            for event in window.events:
                assert window.t_start <= event.t <= window.t_end, (
                    f"event {event.event_id} at {event.t} escaped "
                    f"[{window.t_start}, {window.t_end}]"
                )
    finally:
        await session.close()


@pytest.mark.asyncio
async def test_causal_links_survive_into_stats(test_video, stub_models):
    session = LiveSession(game_title="Stumble Guys", window_seconds=8, overlap_seconds=4)
    await session.attach_source(test_video)
    try:
        await session.mark_ended()
        await session.drain(timeout=120)
        stats = session.annotator.state.stats()
        assert stats["events_extracted"] > 0
        assert stats["causal_links"] > 0
        assert stats["usage"]["cost_usd"] > 0
    finally:
        await session.close()


# -- fan-out ------------------------------------------------------------


@pytest.mark.asyncio
async def test_subscribers_receive_annotation_events(test_video, stub_models):
    session = LiveSession(game_title="Stumble Guys", window_seconds=8, overlap_seconds=4)
    await session.attach_source(test_video)
    queue = session.subscribe()
    try:
        await session.mark_ended()
        await session.drain(timeout=120)
        kinds = []
        while not queue.empty():
            event = queue.get_nowait()
            if event is not None:
                kinds.append(event.kind)
        assert "episode_identified" in kinds
        assert "triage" in kinds
        assert "window" in kinds
    finally:
        await session.close()


@pytest.mark.asyncio
async def test_slow_subscriber_is_dropped_not_blocking(test_video, stub_models):
    """A stalled UI client must not be able to throttle annotation."""
    session = LiveSession(game_title="Stumble Guys", window_seconds=8, overlap_seconds=4)
    await session.attach_source(test_video)
    slow = session.subscribe()
    # Fill the queue so every further publish overflows it.
    while not slow.full():
        slow.put_nowait(None)
    try:
        await session.mark_ended()
        await session.drain(timeout=120)
        assert slow not in session._subscribers
        assert len(session.annotator.state.windows) > 0
    finally:
        await session.close()


@pytest.mark.asyncio
async def test_late_subscriber_gets_history(test_video, stub_models):
    session = LiveSession(game_title="Stumble Guys", window_seconds=8, overlap_seconds=4)
    await session.attach_source(test_video)
    try:
        await session.mark_ended()
        await session.drain(timeout=120)
        late = session.subscribe()
        assert not late.empty()
    finally:
        await session.close()


# -- pacer --------------------------------------------------------------


@pytest.mark.asyncio
async def test_pacer_respects_wall_clock(test_video, stub_models):
    """Windows must not be annotated before their footage would have arrived."""
    session = LiveSession(game_title="Stumble Guys", window_seconds=8, overlap_seconds=4)
    seen: list[tuple[float, float]] = []
    original = session.annotator.process_clip

    async def spy(clip: WindowClip):
        seen.append((asyncio.get_running_loop().time(), clip.t_end))
        return await original(clip)

    session.annotator.process_clip = spy  # type: ignore[method-assign]

    pacer = WallClockPacer(session, test_video, speed=4.0, tick_seconds=0.2)
    started = asyncio.get_running_loop().time()
    try:
        result = await pacer.run(run_arbiter=False)
        for at, t_end in seen:
            stream_elapsed = (at - started) * 4.0
            # Allow a small margin for scheduling, but a window must never be
            # dispatched meaningfully before its content exists.
            assert stream_elapsed >= t_end - 1.0, (
                f"window ending at {t_end}s was annotated after only "
                f"{stream_elapsed:.1f}s of stream time"
            )
        assert result.speed == 4.0
        assert result.paced_realtime is False
        assert result.windows_dispatched > 0
    finally:
        await session.close()


@pytest.mark.asyncio
async def test_pacer_reports_realtime_honestly(test_video, stub_models):
    session = LiveSession(game_title="Stumble Guys", window_seconds=8, overlap_seconds=4)
    pacer = WallClockPacer(session, test_video, speed=1.0, tick_seconds=0.2)
    pacer.stop()  # stop immediately; we only care about the flag
    try:
        result = await pacer.run(run_arbiter=False)
        assert result.paced_realtime is True
    finally:
        await session.close()


@pytest.mark.asyncio
async def test_pacer_rejects_bad_speed(test_video):
    session = LiveSession()
    try:
        with pytest.raises(ValueError):
            WallClockPacer(session, test_video, speed=0)
    finally:
        await session.close()


# -- reel readiness -----------------------------------------------------


@pytest.mark.asyncio
async def test_reel_is_ready_at_stream_end(test_video, stub_models):
    """The payoff claim: only arbitration remains when the stream stops."""
    session = LiveSession(game_title="Stumble Guys", window_seconds=8, overlap_seconds=4)
    pacer = WallClockPacer(session, test_video, speed=8.0, tick_seconds=0.1)
    try:
        result = await pacer.run(run_arbiter=True)
        assert result.summary["annotation"]["windows_annotated"] > 0
        assert len(result.summary["segments"]) > 0
        for segment in result.summary["segments"]:
            assert segment["t_end"] > segment["t_start"]
            assert 0 <= segment["score"] <= 100
    finally:
        await session.close()


@pytest.mark.asyncio
async def test_registry_evicts_oldest_session():
    registry = SessionRegistry(max_sessions=2)
    a = registry.create()
    b = registry.create()
    assert len(registry.list_ids()) == 2
    c = registry.create()
    assert len(registry.list_ids()) == 2
    assert c.session_id in registry.list_ids()
    assert a.session_id not in registry.list_ids()
    for session in (b, c):
        await session.close()


def test_candidate_selection_prefers_high_magnitude_and_avoids_overlap():
    from schemas.world_annotation import AnnotatedEvent

    windows = [
        DenseWindow(
            window_id=f"w{i}",
            t_start=i * 10.0,
            t_end=i * 10.0 + 8.0,
            events=[
                AnnotatedEvent(
                    event_id=f"e{i}",
                    event_type=EventType.ELIMINATION,
                    t=i * 10.0 + 1,
                    magnitude=mag,
                )
            ],
        )
        for i, mag in enumerate([10, 95, 50, 80])
    ]
    spans = select_candidate_spans(windows, max_spans=3)
    assert (10.0, 18.0) in spans  # magnitude 95 must be chosen
    for i, (s1, e1) in enumerate(spans):
        for s2, e2 in spans[i + 1 :]:
            assert e1 <= s2 or e2 <= s1, "selected spans must not overlap"
