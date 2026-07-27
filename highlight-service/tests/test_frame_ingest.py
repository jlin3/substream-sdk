"""Tests for the mobile frame-tap ingest path.

The iOS annotation tap sends downscaled JPEGs at 1-2fps rather than a second
encoded stream. These tests drive that path with real JPEGs through a real
WebSocket and confirm windows still get annotated on the same code path as the
file-based flow.
"""

from __future__ import annotations

import json
import os
import subprocess
import sys
import tempfile

import pytest
from fastapi.testclient import TestClient

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from pipeline import annotator as annotator_mod  # noqa: E402
from pipeline.live_session import LiveSession  # noqa: E402
from schemas.world_annotation import parse_dense_window  # noqa: E402
from services.genai_client import CallRecord, estimate_cost  # noqa: E402


@pytest.fixture(scope="module")
def jpeg_frames():
    """Render a handful of real JPEG frames to feed the tap."""
    d = tempfile.mkdtemp(prefix="substream_frames_")
    subprocess.run(
        [
            "ffmpeg", "-y", "-loglevel", "error",
            "-f", "lavfi", "-i", "testsrc=size=480x270:rate=1:duration=24",
            "-q:v", "6", os.path.join(d, "f%04d.jpg"),
        ],
        check=True,
        capture_output=True,
        timeout=120,
    )
    frames = []
    for name in sorted(os.listdir(d)):
        if name.endswith(".jpg"):
            with open(os.path.join(d, name), "rb") as f:
                frames.append(f.read())
    assert len(frames) >= 20
    yield frames


@pytest.fixture
def stub_models(monkeypatch):
    def fake_identify(clip, meter, hint=None):
        return {
            "game_title": hint or "Stumble Guys",
            "genre": "party_battle_royale",
            "perspective": "third_person_close",
            "contains_real_world_video": False,
            "notes": "stub",
        }

    def fake_triage(clip, genre, meter):
        meter.record(_rec("gemini-3.5-flash-lite", "triage", 800, 80))
        return {"salience": 90, "reason": "stub", "likely_events": [], "is_gameplay": True}

    def fake_annotate(clip, genre, game_title, ctx, meter):
        meter.record(_rec("gemini-3.6-flash", "dense_annotation", 2500, 1200))
        return parse_dense_window(
            {
                "camera": {
                    "perspective": "third_person_close",
                    "motion": "follow",
                    "motion_magnitude": 40,
                    "shake": 20,
                    "cut_detected": False,
                },
                "agent": {
                    "action_category": "locomotion",
                    "action": "run",
                    "movement_mode": "grounded",
                    "intent": "advance",
                    "control_confidence": 75,
                },
                "entities": [],
                "events": [],
                "physics": ["none"],
                "affordances": ["jump"],
                "ui_state": {},
                "reward_signal": 0.1,
                "scene_caption": f"frames {clip.t_start:.0f}-{clip.t_end:.0f}",
                "uncertainty": {
                    "camera": 80, "agent": 70, "entities": 50, "events": 60, "ui_state": 40
                },
            },
            f"w{clip.index:05d}",
            clip.t_start,
            clip.t_end,
        )

    monkeypatch.setattr(annotator_mod, "identify_episode", fake_identify)
    monkeypatch.setattr(annotator_mod, "triage_window", fake_triage)
    monkeypatch.setattr(annotator_mod, "annotate_window", fake_annotate)
    return True


def _rec(model, purpose, in_tok, out_tok):
    return CallRecord(
        model=model,
        purpose=purpose,
        input_tokens=in_tok,
        output_tokens=out_tok,
        cached_tokens=0,
        cost_usd=estimate_cost(model, in_tok, out_tok),
        latency_ms=8.0,
    )


@pytest.mark.asyncio
async def test_frames_mux_into_annotatable_windows(jpeg_frames, stub_models):
    """Frames tee'd at 1fps must produce the same annotations as a file would."""
    session = LiveSession(game_title="Stumble Guys", window_seconds=8, overlap_seconds=4)
    session.frame_mode = True
    try:
        for i, frame in enumerate(jpeg_frames):
            await session.ingest_frame(frame, float(i))
        await session.mark_ended()
        await session.drain(timeout=180)

        windows = session.annotator.state.windows
        assert windows, "no windows annotated from frame tap"
        assert session.stats.bytes_ingested > 0
        assert session.stats.chunks_ingested == len(jpeg_frames)
        for w in windows:
            assert w.scene_caption
    finally:
        await session.close()


@pytest.mark.asyncio
async def test_frame_pruning_bounds_memory(jpeg_frames, stub_models):
    """Old frames must be released; a long stream cannot accumulate forever."""
    session = LiveSession(game_title="Stumble Guys", window_seconds=8, overlap_seconds=4)
    session.frame_mode = True
    try:
        for i, frame in enumerate(jpeg_frames):
            await session.ingest_frame(frame, float(i))
        await session.mark_ended()
        await session.drain(timeout=180)
        # After processing, retained frames must be far fewer than ingested.
        assert len(session._frames) < len(jpeg_frames)
    finally:
        await session.close()


@pytest.mark.asyncio
async def test_frame_mode_rejects_after_close(jpeg_frames):
    session = LiveSession()
    session.frame_mode = True
    await session.close()
    with pytest.raises(RuntimeError):
        await session.ingest_frame(jpeg_frames[0], 0.0)


def test_frame_websocket_protocol(jpeg_frames, stub_models, monkeypatch):
    """Header-then-binary framing over a real WebSocket."""
    import main

    with TestClient(main.app) as client:
        created = client.post(
            "/api/v1/live/sessions",
            json={"game_title": "Stumble Guys", "window_seconds": 8, "overlap_seconds": 4},
        ).json()
        session_id = created["session_id"]
        assert created["frames_ws"].endswith("/frames")

        with client.websocket_connect(created["frames_ws"]) as ws:
            for i, frame in enumerate(jpeg_frames[:20]):
                ws.send_text(json.dumps({"type": "frame", "pts": float(i)}))
                ws.send_bytes(frame)
            ws.send_text(json.dumps({"type": "end"}))

        summary = client.get(f"/api/v1/live/sessions/{session_id}").json()
        assert summary["bytes_ingested"] > 0
        assert summary["windows_dispatched"] > 0


def test_frame_without_header_is_dropped_not_fatal(jpeg_frames, stub_models):
    """A stray binary frame must not kill the ingest connection."""
    import main

    with TestClient(main.app) as client:
        created = client.post("/api/v1/live/sessions", json={}).json()
        with client.websocket_connect(created["frames_ws"]) as ws:
            ws.send_bytes(jpeg_frames[0])  # no header first
            ws.send_text(json.dumps({"type": "frame", "pts": 0.0}))
            ws.send_bytes(jpeg_frames[0])
            ws.send_text(json.dumps({"type": "end"}))

        summary = client.get(f"/api/v1/live/sessions/{created['session_id']}").json()
        # Only the properly-framed frame counted.
        assert summary["bytes_ingested"] == len(jpeg_frames[0])


def test_ios_client_literal_wire_format(jpeg_frames, stub_models):
    """Accept the byte-for-byte header the Swift tap emits.

    The iOS tap builds its header by string concatenation rather than a JSON
    encoder, to avoid an encoder allocation per frame inside a memory-capped
    broadcast extension. That makes the wire format a hand-written literal on the
    client and a json.loads on the server, which is exactly the kind of contract
    that drifts silently. These are the literals from AnnotationTap.swift; if
    either side changes shape, this fails instead of the demo failing.
    """
    import main

    with TestClient(main.app) as client:
        created = client.post(
            "/api/v1/live/sessions",
            json={"game_title": "Stumble Guys", "window_seconds": 8, "overlap_seconds": 4},
        ).json()
        session_id = created["session_id"]

        with client.websocket_connect(created["frames_ws"]) as ws:
            for i, frame in enumerate(jpeg_frames[:12]):
                # String(format: "%.3f", seconds) in AnnotationTap.send(...)
                ws.send_text('{"type":"frame","pts":%.3f}' % float(i))
                ws.send_bytes(frame)
            # AnnotationTap.stop()
            ws.send_text('{"type":"end"}')

        summary = client.get(f"/api/v1/live/sessions/{session_id}").json()
        assert summary["bytes_ingested"] == sum(len(f) for f in jpeg_frames[:12])
        assert summary["chunks_ingested"] == 12


def test_frames_ws_rejects_unknown_session():
    import main

    with TestClient(main.app) as client:
        with pytest.raises(Exception):
            with client.websocket_connect("/api/v1/live/sessions/nope/frames"):
                pass
