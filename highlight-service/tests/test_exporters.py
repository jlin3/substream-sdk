"""Exporter tests.

These read the written files back rather than trusting the writer. An export
format is only useful if a consumer can load it, so every test round-trips.
"""

from __future__ import annotations

import json
import os
import sys
import tempfile

import pytest

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from exporters.corpus import (  # noqa: E402
    DENSE_WINDOW_COLUMNS,
    export_all,
    export_jsonl,
    export_lerobot,
    export_parquet,
    export_rlds,
)
from schemas.world_annotation import (  # noqa: E402
    Action,
    ActionCategory,
    AgentObservation,
    AnnotatedEvent,
    CameraMotion,
    CameraObservation,
    DenseWindow,
    EntityObservation,
    EntityRole,
    Episode,
    EpisodeMetadata,
    EventType,
    Genre,
    MovementMode,
    NarrativeSegment,
    Outcome,
    PhysicsEvent,
    UIState,
    Uncertainty,
)


def make_episode(
    episode_id: str = "ep_test",
    windows: int = 5,
    training_use: bool = True,
    genre: Genre = Genre.PARTY_BATTLE_ROYALE,
) -> Episode:
    meta = EpisodeMetadata(
        episode_id=episode_id,
        game_title="Stumble Guys",
        genre=genre,
        platform="ios",
    )
    meta.consent.training_use = training_use
    meta.consent.player_consented = training_use
    meta.capture.duration_seconds = windows * 8.0

    dense = []
    for i in range(windows):
        dense.append(
            DenseWindow(
                window_id=f"w{i:05d}",
                t_start=i * 4.0,
                t_end=i * 4.0 + 8.0,
                camera=CameraObservation(
                    motion=CameraMotion.FOLLOW, motion_magnitude=55, shake=30
                ),
                agent=AgentObservation(
                    action_category=ActionCategory.LOCOMOTION,
                    action=Action.JUMP,
                    movement_mode=MovementMode.AIRBORNE,
                    intent="cross the gap",
                    control_confidence=85,
                ),
                entities=[
                    EntityObservation(
                        entity_id="e1",
                        role=EntityRole.OBSTACLE,
                        label="spinning bar",
                        salience=70,
                    )
                ],
                events=[
                    AnnotatedEvent(
                        event_id=f"c{i}",
                        event_type=EventType.COLLISION,
                        t=i * 4.0 + 2.0,
                        outcome=Outcome.FAILURE,
                        magnitude=60,
                    ),
                    AnnotatedEvent(
                        event_id=f"k{i}",
                        event_type=EventType.KNOCKBACK,
                        t=i * 4.0 + 2.5,
                        outcome=Outcome.FAILURE,
                        magnitude=75,
                        cause_event_id=f"c{i}",
                    ),
                ],
                physics=[PhysicsEvent.COLLISION, PhysicsEvent.RAGDOLL],
                affordances=["jump", "run"],
                ui_state=UIState(players_remaining=20 - i, raw_text=[f"{20-i} LEFT"]),
                reward_signal=-0.5,
                scene_caption=f"window {i}",
                uncertainty=Uncertainty(
                    camera=90, agent=85, entities=70, events=80, ui_state=60
                ),
            )
        )

    segments = [
        NarrativeSegment(
            segment_id="s0",
            t_start=4.0,
            t_end=12.0,
            score=85.0,
            label="wipeout",
            shareability=90,
        )
    ]
    return Episode(metadata=meta, windows=dense, segments=segments)


@pytest.fixture
def out_dir():
    with tempfile.TemporaryDirectory(prefix="substream_export_") as d:
        yield d


# -- JSONL --------------------------------------------------------------


def test_jsonl_round_trips(out_dir):
    episode = make_episode(windows=3)
    path = os.path.join(out_dir, "episodes.jsonl")
    report = export_jsonl([episode], path)

    assert report.episodes_written == 1
    with open(path) as f:
        lines = [json.loads(line) for line in f]
    assert len(lines) == 1
    assert lines[0]["metadata"]["episode_id"] == "ep_test"
    assert len(lines[0]["windows"]) == 3
    # Causal links must survive serialization; they are the point.
    assert lines[0]["windows"][0]["events"][1]["cause_event_id"] == "c0"


# -- consent ------------------------------------------------------------


def test_consent_gate_excludes_unconsented_episodes(out_dir):
    allowed = make_episode("ep_ok", training_use=True)
    blocked = make_episode("ep_blocked", training_use=False)
    path = os.path.join(out_dir, "episodes.jsonl")
    report = export_jsonl([allowed, blocked], path)

    assert report.episodes_written == 1
    assert report.episodes_skipped_consent == 1
    with open(path) as f:
        ids = [json.loads(line)["metadata"]["episode_id"] for line in f]
    assert ids == ["ep_ok"]


def test_consent_gate_can_be_disabled_explicitly(out_dir):
    blocked = make_episode("ep_blocked", training_use=False)
    path = os.path.join(out_dir, "episodes.jsonl")
    report = export_jsonl([blocked], path, enforce_consent=False)
    assert report.episodes_written == 1
    assert report.episodes_skipped_consent == 0


# -- Parquet ------------------------------------------------------------


def test_parquet_dense_layer_round_trips(out_dir):
    import pyarrow.parquet as pq

    episode = make_episode(windows=4)
    path = os.path.join(out_dir, "dense.parquet")
    report = export_parquet([episode], path)

    assert report.rows_written == 4
    table = pq.read_table(path)
    assert table.num_rows == 4
    assert set(table.column_names) == set(DENSE_WINDOW_COLUMNS)
    rows = table.to_pylist()
    assert rows[0]["has_causal_chain"] is True
    assert rows[0]["agent_action"] == "jump"
    assert rows[0]["physics"] == "collision|ragdoll"
    assert rows[0]["ui_players_remaining"] == 20


def test_parquet_schema_is_stable_across_null_heavy_batches(out_dir):
    """A batch of all-null optional columns must not change dtypes."""
    import pyarrow.parquet as pq

    sparse = make_episode("ep_sparse", windows=2)
    for window in sparse.windows:
        window.ui_state = UIState()  # every HUD field absent

    dense_path = os.path.join(out_dir, "a.parquet")
    sparse_path = os.path.join(out_dir, "b.parquet")
    export_parquet([make_episode("ep_dense", windows=2)], dense_path)
    export_parquet([sparse], sparse_path)

    assert pq.read_schema(dense_path).equals(pq.read_schema(sparse_path))


# -- LeRobot ------------------------------------------------------------


def test_lerobot_layout_matches_v3_spec(out_dir):
    episode = make_episode(windows=6)
    target = os.path.join(out_dir, "lerobot")
    report = export_lerobot([episode], target)

    assert report.format == "lerobot_v3"
    for expected in (
        "meta/info.json",
        "meta/tasks.parquet",
        "meta/episodes/chunk-000/file-000.parquet",
        "data/chunk-000/file-000.parquet",
    ):
        assert os.path.exists(os.path.join(target, expected)), f"missing {expected}"


def test_lerobot_info_json_declares_v3_and_features(out_dir):
    episode = make_episode(windows=6)
    target = os.path.join(out_dir, "lerobot")
    export_lerobot([episode], target, fps=1)

    with open(os.path.join(target, "meta", "info.json")) as f:
        info = json.load(f)

    assert info["codebase_version"] == "v3.0"
    assert info["total_episodes"] == 1
    assert info["total_frames"] == 6
    assert info["fps"] == 1
    assert "observation.image" in info["features"]
    assert "action" in info["features"]
    assert "next.reward" in info["features"]
    # Path templates must use the chunk_index placeholder LeRobot resolves.
    assert "{chunk_index:03d}" in info["data_path"]
    assert info["substream"]["annotation_schema"] == "swa-1"


def test_lerobot_data_parquet_has_required_columns(out_dir):
    import pyarrow.parquet as pq

    episode = make_episode(windows=5)
    target = os.path.join(out_dir, "lerobot")
    export_lerobot([episode], target)

    table = pq.read_table(os.path.join(target, "data", "chunk-000", "file-000.parquet"))
    for column in (
        "observation.state",
        "action",
        "next.reward",
        "next.done",
        "timestamp",
        "frame_index",
        "episode_index",
        "index",
        "task_index",
    ):
        assert column in table.column_names, f"missing {column}"

    rows = table.to_pylist()
    assert len(rows) == 5
    assert len(rows[0]["observation.state"]) == 7
    assert len(rows[0]["action"]) == 3
    # Only the final timestep of an episode is done.
    assert rows[-1]["next.done"] is True
    assert rows[0]["next.done"] is False
    # Global index must be contiguous across the dataset.
    assert [r["index"] for r in rows] == list(range(5))


def test_lerobot_multi_episode_indices_are_global(out_dir):
    import pyarrow.parquet as pq

    episodes = [make_episode(f"ep{i}", windows=3) for i in range(3)]
    target = os.path.join(out_dir, "lerobot")
    export_lerobot(episodes, target)

    rows = pq.read_table(
        os.path.join(target, "data", "chunk-000", "file-000.parquet")
    ).to_pylist()
    assert len(rows) == 9
    assert [r["index"] for r in rows] == list(range(9))
    assert sorted({r["episode_index"] for r in rows}) == [0, 1, 2]
    # frame_index restarts per episode while index does not.
    assert [r["frame_index"] for r in rows] == [0, 1, 2] * 3


def test_lerobot_episodes_metadata_carries_rights_flags(out_dir):
    import pyarrow.parquet as pq

    episode = make_episode(windows=3, genre=Genre.AR_LOCATION)
    episode.metadata.consent.contains_real_world_video = True
    episode.metadata.consent.commercial_license = True
    target = os.path.join(out_dir, "lerobot")
    export_lerobot([episode], target)

    rows = pq.read_table(
        os.path.join(target, "meta", "episodes", "chunk-000", "file-000.parquet")
    ).to_pylist()
    assert rows[0]["genre"] == "ar_location"
    assert rows[0]["contains_real_world_video"] is True
    assert rows[0]["commercial_license"] is True
    assert rows[0]["length"] == 3


def test_lerobot_copies_video_when_provided(out_dir):
    episode = make_episode(windows=2)
    fake_video = os.path.join(out_dir, "src.mp4")
    with open(fake_video, "wb") as f:
        f.write(b"\x00" * 128)

    target = os.path.join(out_dir, "lerobot")
    export_lerobot([episode], target, video_paths={"ep_test": fake_video})

    expected = os.path.join(
        target, "videos", "observation.image", "chunk-000", "file-000.mp4"
    )
    assert os.path.exists(expected)
    with open(os.path.join(target, "meta", "info.json")) as f:
        assert json.load(f)["total_videos"] == 1


# -- RLDS ---------------------------------------------------------------


def test_rlds_step_boundaries_are_correct(out_dir):
    episode = make_episode(windows=4)
    path = os.path.join(out_dir, "rlds.jsonl")
    report = export_rlds([episode], path)

    assert report.rows_written == 4
    with open(path) as f:
        record = json.loads(f.readline())

    steps = record["steps"]
    assert steps[0]["is_first"] is True
    assert steps[0]["is_last"] is False
    assert steps[-1]["is_last"] is True
    assert steps[-1]["is_terminal"] is True
    assert steps[0]["action"]["action_name"] == "jump"
    assert record["episode_metadata"]["annotation_schema"] == "swa-1"


# -- action vocabulary --------------------------------------------------


def test_action_ids_are_stable_and_distinct(out_dir):
    """Action ids are a wire contract; a remap would corrupt earlier exports."""
    from exporters.corpus import _action_vocab

    cat_ids, action_ids, mode_ids = _action_vocab()
    assert action_ids["idle"] == 0
    assert action_ids["none"] == len(action_ids) - 1
    assert len(set(action_ids.values())) == len(action_ids)
    assert cat_ids["locomotion"] == 0


# -- combined -----------------------------------------------------------


def test_export_all_writes_every_format(out_dir):
    episodes = [make_episode(f"ep{i}", windows=3) for i in range(2)]
    reports = export_all(episodes, out_dir)

    assert set(reports) == {"jsonl", "parquet", "lerobot_v3", "rlds"}
    for name, report in reports.items():
        assert report["episodes_written"] == 2, name
    assert os.path.exists(os.path.join(out_dir, "episodes.jsonl"))
    assert os.path.exists(os.path.join(out_dir, "dense_windows.parquet"))
    assert os.path.exists(os.path.join(out_dir, "rlds.jsonl"))
    assert os.path.exists(os.path.join(out_dir, "lerobot", "meta", "info.json"))


def test_export_handles_empty_episode_list(out_dir):
    reports = export_all([], out_dir)
    for name, report in reports.items():
        assert report["episodes_written"] == 0, name
        assert report["rows_written"] == 0, name
