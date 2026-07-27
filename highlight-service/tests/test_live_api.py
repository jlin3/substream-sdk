"""API-level tests for the live annotation endpoints.

Exercises the HTTP surface the demo console actually calls, with the model tier
stubbed. Covers the SSE contract, validation, and the path-traversal guard on
content serving.
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
from schemas.world_annotation import NarrativeSegment, parse_dense_window  # noqa: E402
from services.genai_client import CallRecord, estimate_cost  # noqa: E402


@pytest.fixture(scope="module")
def content_dir():
    d = tempfile.mkdtemp(prefix="substream_api_content_")
    path = os.path.join(d, "clip.mp4")
    subprocess.run(
        [
            "ffmpeg", "-y", "-loglevel", "error",
            "-f", "lavfi", "-i", "testsrc=size=640x360:rate=30:duration=20",
            "-f", "lavfi", "-i", "sine=frequency=440:duration=20",
            "-c:v", "libx264", "-preset", "ultrafast", "-pix_fmt", "yuv420p",
            "-c:a", "aac", "-shortest", path,
        ],
        check=True,
        capture_output=True,
        timeout=120,
    )
    manifest = {
        "content": [
            {
                "title": "Stumble Guys",
                "path": path,
                "duration": 20.0,
                "genre_hint": "party_battle_royale",
                "width": 640,
                "height": 360,
                "fps": 30.0,
                "cached_annotation": False,
            }
        ]
    }
    with open(os.path.join(d, "manifest.json"), "w") as f:
        json.dump(manifest, f)
    yield d, path


@pytest.fixture
def client(content_dir, monkeypatch):
    d, _ = content_dir
    monkeypatch.setenv("DEMO_CONTENT_DIR", d)

    # api.demo resolves CONTENT_DIR at import time, so patch the module value.
    import api.demo as demo_mod

    monkeypatch.setattr(demo_mod, "CONTENT_DIR", os.path.abspath(d))

    def fake_identify(clip, meter, hint=None):
        return {
            "game_title": hint or "Stumble Guys",
            "genre": "party_battle_royale",
            "perspective": "third_person_close",
            "contains_real_world_video": False,
            "notes": "stub",
        }

    def fake_triage(clip, genre, meter):
        meter.record(_rec("gemini-3.5-flash-lite", "triage", 900, 90))
        return {
            "salience": 80,
            "reason": "stub",
            "likely_events": ["knockback"],
            "is_gameplay": True,
        }

    def fake_annotate(clip, genre, game_title, ctx, meter):
        meter.record(_rec("gemini-3.6-flash", "dense_annotation", 2800, 1300))
        mid = clip.t_start + (clip.t_end - clip.t_start) / 2
        return parse_dense_window(
            {
                "camera": {
                    "perspective": "third_person_close",
                    "motion": "follow",
                    "motion_magnitude": 50,
                    "shake": 25,
                    "cut_detected": False,
                },
                "agent": {
                    "action_category": "locomotion",
                    "action": "jump",
                    "movement_mode": "airborne",
                    "intent": "cross gap",
                    "control_confidence": 80,
                },
                "entities": [],
                "events": [
                    {
                        "event_id": "a",
                        "event_type": "collision",
                        "t": mid,
                        "outcome": "failure",
                        "magnitude": 60,
                    },
                    {
                        "event_id": "b",
                        "event_type": "knockback",
                        "t": mid + 0.3,
                        "outcome": "failure",
                        "magnitude": 82,
                        "cause_event_id": "a",
                    },
                ],
                "physics": ["ragdoll"],
                "affordances": ["jump"],
                "ui_state": {"players_remaining": 11},
                "reward_signal": -0.6,
                "scene_caption": f"knocked off at {mid:.0f}s",
                "uncertainty": {
                    "camera": 88, "agent": 82, "entities": 60, "events": 79, "ui_state": 55
                },
            },
            f"w{clip.index:05d}",
            clip.t_start,
            clip.t_end,
        )

    def fake_score(clip, genre, game_title, ctx, meter):
        meter.record(_rec("gemini-3.1-pro-preview", "narrative_arbiter", 7000, 500))
        return NarrativeSegment(
            segment_id=f"s{clip.index:05d}",
            t_start=clip.t_start,
            t_end=clip.t_end,
            score=80.0,
            label="wipeout",
            shareability=88,
            protected_chain=True,
        )

    monkeypatch.setattr(annotator_mod, "identify_episode", fake_identify)
    monkeypatch.setattr(annotator_mod, "triage_window", fake_triage)
    monkeypatch.setattr(annotator_mod, "annotate_window", fake_annotate)
    monkeypatch.setattr(annotator_mod, "score_segment", fake_score)

    import main

    with TestClient(main.app) as c:
        yield c


def _rec(model, purpose, in_tok, out_tok):
    return CallRecord(
        model=model,
        purpose=purpose,
        input_tokens=in_tok,
        output_tokens=out_tok,
        cached_tokens=0,
        cost_usd=estimate_cost(model, in_tok, out_tok),
        latency_ms=10.0,
    )


# -- health and readiness ----------------------------------------------


def test_health_reports_schema_and_tiers(client):
    data = client.get("/health").json()
    assert data["annotation_schema"] == "swa-1"
    assert data["gemini"]["models"]["triage"] == "gemini-3.5-flash-lite"
    assert data["gemini"]["models"]["dense"] == "gemini-3.6-flash"
    assert data["gemini"]["video_intelligence_enabled"] is False
    assert data["windowing"]["dense_seconds"] == 8.0


def test_demo_status_lists_blockers(client):
    data = client.get("/api/v1/demo/status").json()
    assert data["content_count"] == 1
    assert isinstance(data["blockers"], list)


def test_content_listing_uses_manifest(client):
    data = client.get("/api/v1/demo/content").json()
    assert data["manifest"] is True
    assert data["content"][0]["title"] == "Stumble Guys"
    assert data["content"][0]["genre_hint"] == "party_battle_royale"


# -- content serving ----------------------------------------------------


def test_content_stream_supports_range(client, content_dir):
    _, path = content_dir
    res = client.get(
        "/api/v1/demo/content/stream", params={"path": path}, headers={"Range": "bytes=0-511"}
    )
    assert res.status_code == 206
    assert res.headers["content-length"] == "512"
    assert "content-range" in res.headers


def test_content_stream_rejects_absolute_traversal(client):
    res = client.get("/api/v1/demo/content/stream", params={"path": "/etc/passwd"})
    assert res.status_code == 403


def test_content_stream_rejects_relative_traversal(client):
    res = client.get(
        "/api/v1/demo/content/stream", params={"path": "../../../../etc/passwd"}
    )
    assert res.status_code == 403


def test_content_stream_rejects_bad_range(client, content_dir):
    _, path = content_dir
    res = client.get(
        "/api/v1/demo/content/stream",
        params={"path": path},
        headers={"Range": "bytes=abc-def"},
    )
    assert res.status_code == 416


# -- session validation -------------------------------------------------


def test_create_session_rejects_overlap_at_or_above_window(client):
    res = client.post(
        "/api/v1/live/sessions", json={"window_seconds": 8.0, "overlap_seconds": 8.0}
    )
    assert res.status_code == 400
    assert "stride" in res.json()["detail"]


def test_create_session_returns_transport_urls(client):
    res = client.post("/api/v1/live/sessions", json={"game_title": "Halo"})
    assert res.status_code == 200
    body = res.json()
    assert body["session_id"]
    assert body["episode_id"].startswith("ep_")
    assert body["annotations_sse"].endswith("/annotations")
    assert "ingest" in body["ingest_ws"]


def test_unknown_session_returns_404(client):
    assert client.get("/api/v1/live/sessions/nope").status_code == 404
    assert client.get("/api/v1/live/sessions/nope/episode").status_code == 404


def test_replay_rejects_missing_file(client):
    res = client.post(
        "/api/v1/live/replay", json={"source_path": "/tmp/does-not-exist.mp4"}
    )
    assert res.status_code == 404


def test_replay_rejects_out_of_range_speed(client, content_dir):
    _, path = content_dir
    res = client.post("/api/v1/live/replay", json={"source_path": path, "speed": 0})
    assert res.status_code == 422


# -- full annotation run over SSE --------------------------------------


def test_replay_streams_annotations_over_sse(client, content_dir):
    """The end-to-end contract the demo console depends on."""
    _, path = content_dir
    res = client.post(
        "/api/v1/live/replay",
        json={
            "source_path": path,
            "game_title": "Stumble Guys",
            "speed": 20.0,
            "run_arbiter": True,
        },
    )
    assert res.status_code == 200
    session_id = res.json()["session_id"]
    assert res.json()["paced_realtime"] is False

    kinds: list[str] = []
    events: list[dict] = []
    with client.stream(
        "GET", f"/api/v1/live/sessions/{session_id}/annotations"
    ) as stream:
        current_kind = None
        for line in stream.iter_lines():
            if line.startswith("event: "):
                current_kind = line[7:].strip()
            elif line.startswith("data: "):
                payload = json.loads(line[6:])
                kinds.append(current_kind or payload.get("kind", ""))
                events.append(payload)
                if current_kind == "done":
                    break

    assert "episode_identified" in kinds
    assert "triage" in kinds
    assert "window" in kinds
    assert "done" in kinds

    identified = next(e for e, k in zip(events, kinds) if k == "episode_identified")
    assert identified["genre"] == "party_battle_royale"

    windows = [e for e, k in zip(events, kinds) if k == "window"]
    assert windows
    first = windows[0]["window"]
    assert first["agent"]["action"] == "jump"
    assert any(ev["cause_event_id"] for ev in first["events"]), "causal link lost over SSE"

    done = next(e for e, k in zip(events, kinds) if k == "done")
    assert done["annotation"]["windows_annotated"] > 0
    assert done["annotation"]["causal_links"] > 0
    assert done["annotation"]["usage"]["cost_usd"] > 0
    assert "time_to_reel_seconds" in done


def test_episode_endpoint_returns_full_swa1(client, content_dir):
    _, path = content_dir
    res = client.post(
        "/api/v1/live/replay",
        json={"source_path": path, "speed": 20.0, "run_arbiter": False},
    )
    session_id = res.json()["session_id"]

    with client.stream(
        "GET", f"/api/v1/live/sessions/{session_id}/annotations"
    ) as stream:
        for line in stream.iter_lines():
            if line.startswith("event: done"):
                break

    episode = client.get(f"/api/v1/live/sessions/{session_id}/episode").json()
    assert episode["metadata"]["schema_version"] == "swa-1"
    assert episode["metadata"]["genre"] == "party_battle_royale"
    assert episode["metadata"]["capture"]["width"] == 640
    assert len(episode["windows"]) > 0
    window = episode["windows"][0]
    for key in (
        "camera",
        "agent",
        "entities",
        "events",
        "physics",
        "affordances",
        "ui_state",
        "reward_signal",
        "uncertainty",
    ):
        assert key in window, f"SWA-1 layer 2 missing {key}"
