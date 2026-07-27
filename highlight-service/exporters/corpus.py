"""Export annotated episodes into formats world-model teams already ingest.

The most credible signal that a dataset is usable is not a well-designed schema,
it is loading in the tooling a team already runs. So the primary export target is
the LeRobot v3.0 layout, which is what current VLA and world-model codebases read,
with Parquet for the dense layer and RLDS-style JSONL as a secondary path for
TFDS pipelines.

Three exporters:

  export_jsonl     One JSON object per episode. Lossless, the archival form.
  export_parquet   Flat columnar dense layer. What an analyst or dataloader wants.
  export_lerobot   LeRobot v3.0 directory layout with meta/, data/ and videos/.
  export_rlds      JSONL shaped as RLDS steps, for TFDS ingestion.

Consent is enforced at export, not at capture. Anything without `training_use`
is dropped and counted, so a filtered export is visibly filtered rather than
silently short.
"""

from __future__ import annotations

import json
import logging
import os
import shutil
from dataclasses import dataclass
from typing import Any, Iterable, Optional

from schemas.world_annotation import (
    DENSE_WINDOW_COLUMNS,
    SCHEMA_VERSION,
    Episode,
    flatten_window,
)

logger = logging.getLogger(__name__)

# LeRobot v3.0 shards data across chunked files rather than one file per episode,
# because one-file-per-episode does not survive datasets with millions of them.
DEFAULT_CHUNK_SIZE = 1000
DATA_PATH_TEMPLATE = "data/chunk-{chunk:03d}/file-{file_index:03d}.parquet"
VIDEO_PATH_TEMPLATE = "videos/{video_key}/chunk-{chunk:03d}/file-{file_index:03d}.mp4"
EPISODES_PATH_TEMPLATE = "meta/episodes/chunk-{chunk:03d}/file-{file_index:03d}.parquet"


@dataclass
class ExportReport:
    format: str
    output_path: str
    episodes_written: int
    episodes_skipped_consent: int
    rows_written: int
    files_written: list[str]

    def as_dict(self) -> dict[str, Any]:
        return {
            "format": self.format,
            "output_path": self.output_path,
            "episodes_written": self.episodes_written,
            "episodes_skipped_consent": self.episodes_skipped_consent,
            "rows_written": self.rows_written,
            "files_written": self.files_written,
        }


def _consent_ok(episode: Episode, enforce: bool) -> bool:
    if not enforce:
        return True
    return bool(episode.metadata.consent.training_use)


def _partition_by_consent(
    episodes: Iterable[Episode], enforce_consent: bool
) -> tuple[list[Episode], int]:
    allowed: list[Episode] = []
    skipped = 0
    for episode in episodes:
        if _consent_ok(episode, enforce_consent):
            allowed.append(episode)
        else:
            skipped += 1
            logger.info(
                "Excluding episode %s from export: training_use not granted",
                episode.metadata.episode_id,
            )
    return allowed, skipped


# --------------------------------------------------------------------------
# JSONL
# --------------------------------------------------------------------------


def export_jsonl(
    episodes: Iterable[Episode],
    output_path: str,
    enforce_consent: bool = True,
) -> ExportReport:
    """Write one complete episode per line. The lossless archival form."""
    allowed, skipped = _partition_by_consent(episodes, enforce_consent)
    os.makedirs(os.path.dirname(os.path.abspath(output_path)) or ".", exist_ok=True)
    rows = 0
    with open(output_path, "w") as f:
        for episode in allowed:
            f.write(json.dumps(episode.model_dump(mode="json")) + "\n")
            rows += len(episode.windows)
    return ExportReport(
        format="jsonl",
        output_path=output_path,
        episodes_written=len(allowed),
        episodes_skipped_consent=skipped,
        rows_written=rows,
        files_written=[output_path],
    )


# --------------------------------------------------------------------------
# Parquet (dense layer)
# --------------------------------------------------------------------------


def dense_rows(episodes: Iterable[Episode]) -> list[dict[str, Any]]:
    rows: list[dict[str, Any]] = []
    for episode in episodes:
        for index, window in enumerate(episode.windows):
            rows.append(flatten_window(window, episode.metadata.episode_id, index))
    return rows


def _dense_arrow_schema():
    """Explicit Arrow schema for the dense layer.

    Inferring types from data breaks the moment a batch happens to contain only
    nulls in an optional HUD column, which then silently changes dtype between
    shards. Pinning the schema keeps every shard readable as one dataset.
    """
    import pyarrow as pa

    string_cols = {
        "episode_id",
        "window_id",
        "camera_perspective",
        "camera_motion",
        "agent_action_category",
        "agent_action",
        "agent_secondary_action",
        "agent_movement_mode",
        "agent_intent",
        "entity_roles",
        "primary_entity_role",
        "event_types",
        "primary_event_type",
        "primary_event_outcome",
        "physics",
        "affordances",
        "scene_caption",
    }
    bool_cols = {"camera_cut_detected", "has_causal_chain", "telemetry_verified"}
    int_cols = {
        "window_index",
        "camera_motion_magnitude",
        "camera_shake",
        "agent_control_confidence",
        "entity_count",
        "event_count",
        "primary_event_magnitude",
        "ui_lives",
        "ui_rank",
        "ui_players_remaining",
        "uncertainty_camera",
        "uncertainty_agent",
        "uncertainty_entities",
        "uncertainty_events",
        "uncertainty_ui_state",
    }

    fields = []
    for name in DENSE_WINDOW_COLUMNS:
        if name in string_cols:
            fields.append(pa.field(name, pa.string()))
        elif name in bool_cols:
            fields.append(pa.field(name, pa.bool_()))
        elif name in int_cols:
            fields.append(pa.field(name, pa.int64()))
        else:
            fields.append(pa.field(name, pa.float64()))
    return pa.schema(fields)


def _dense_table(rows: list[dict[str, Any]]):
    import pyarrow as pa

    schema = _dense_arrow_schema()
    columns = {
        field.name: pa.array([row.get(field.name) for row in rows], type=field.type)
        for field in schema
    }
    return pa.Table.from_pydict(columns, schema=schema)


def export_parquet(
    episodes: Iterable[Episode],
    output_path: str,
    enforce_consent: bool = True,
) -> ExportReport:
    """Write the flattened dense layer as a single Parquet file."""
    import pyarrow.parquet as pq

    allowed, skipped = _partition_by_consent(episodes, enforce_consent)
    rows = dense_rows(allowed)
    os.makedirs(os.path.dirname(os.path.abspath(output_path)) or ".", exist_ok=True)
    pq.write_table(_dense_table(rows), output_path, compression="zstd")
    return ExportReport(
        format="parquet",
        output_path=output_path,
        episodes_written=len(allowed),
        episodes_skipped_consent=skipped,
        rows_written=len(rows),
        files_written=[output_path],
    )


# --------------------------------------------------------------------------
# LeRobot v3.0
# --------------------------------------------------------------------------

# Feature declaration for meta/info.json. Names are prefixed by domain so a
# consumer can select observation, action or annotation columns without needing
# to know this schema in advance.
LEROBOT_FEATURES: dict[str, dict[str, Any]] = {
    "observation.image": {
        "dtype": "video",
        "shape": [360, 640, 3],
        "names": ["height", "width", "channel"],
    },
    "observation.state": {
        "dtype": "float32",
        "shape": [7],
        "names": [
            "camera_motion_magnitude",
            "camera_shake",
            "ui_health_pct",
            "ui_score",
            "ui_timer_seconds",
            "ui_players_remaining",
            "ui_rank",
        ],
    },
    "action": {
        "dtype": "int64",
        "shape": [3],
        "names": ["action_category_id", "action_id", "movement_mode_id"],
    },
    "next.reward": {"dtype": "float32", "shape": [1], "names": ["reward_signal"]},
    "next.done": {"dtype": "bool", "shape": [1], "names": ["done"]},
    "timestamp": {"dtype": "float32", "shape": [1], "names": ["timestamp"]},
    "frame_index": {"dtype": "int64", "shape": [1], "names": ["frame_index"]},
    "episode_index": {"dtype": "int64", "shape": [1], "names": ["episode_index"]},
    "index": {"dtype": "int64", "shape": [1], "names": ["index"]},
    "task_index": {"dtype": "int64", "shape": [1], "names": ["task_index"]},
    "annotation.scene_caption": {"dtype": "string", "shape": [1], "names": ["caption"]},
    "annotation.event_types": {"dtype": "string", "shape": [1], "names": ["event_types"]},
    "annotation.has_causal_chain": {"dtype": "bool", "shape": [1], "names": ["has_causal_chain"]},
    "annotation.confidence": {"dtype": "float32", "shape": [1], "names": ["confidence"]},
}


def _action_vocab() -> tuple[dict[str, int], dict[str, int], dict[str, int]]:
    """Stable integer ids for the action taxonomy.

    Derived from enum declaration order, which is why the enums are append-only:
    reordering them would silently remap every previously exported label.
    """
    from schemas.world_annotation import Action, ActionCategory, MovementMode

    return (
        {m.value: i for i, m in enumerate(ActionCategory)},
        {m.value: i for i, m in enumerate(Action)},
        {m.value: i for i, m in enumerate(MovementMode)},
    )


def export_lerobot(
    episodes: Iterable[Episode],
    output_dir: str,
    video_paths: Optional[dict[str, str]] = None,
    chunk_size: int = DEFAULT_CHUNK_SIZE,
    fps: int = 1,
    enforce_consent: bool = True,
    robot_type: str = "substream_gameplay_agent",
) -> ExportReport:
    """Write a LeRobot v3.0 dataset directory.

    Layout:
        meta/info.json
        meta/tasks.parquet
        meta/episodes/chunk-000/file-000.parquet
        data/chunk-000/file-000.parquet
        videos/observation.image/chunk-000/file-000.mp4

    `fps` describes the annotation cadence, not the source video framerate. One
    dense window becomes one timestep, so timesteps are windows and the value
    reflects window rate.
    """
    import pyarrow as pa
    import pyarrow.parquet as pq

    allowed, skipped = _partition_by_consent(episodes, enforce_consent)
    video_paths = video_paths or {}
    cat_ids, action_ids, mode_ids = _action_vocab()

    os.makedirs(os.path.join(output_dir, "meta", "episodes"), exist_ok=True)
    files_written: list[str] = []

    tasks: dict[str, int] = {}
    data_rows: list[dict[str, Any]] = []
    episode_rows: list[dict[str, Any]] = []
    global_index = 0

    for episode_index, episode in enumerate(allowed):
        meta = episode.metadata
        task = f"Play {meta.game_title or 'unknown game'} ({meta.genre.value})"
        task_index = tasks.setdefault(task, len(tasks))

        window_count = len(episode.windows)
        for frame_index, window in enumerate(episode.windows):
            confidence = (
                window.uncertainty.camera
                + window.uncertainty.agent
                + window.uncertainty.events
            ) / 300.0
            data_rows.append(
                {
                    "observation.state": [
                        float(window.camera.motion_magnitude),
                        float(window.camera.shake),
                        float(window.ui_state.health_pct or 0.0),
                        float(window.ui_state.score or 0.0),
                        float(window.ui_state.timer_seconds or 0.0),
                        float(window.ui_state.players_remaining or 0),
                        float(window.ui_state.rank or 0),
                    ],
                    "action": [
                        cat_ids.get(window.agent.action_category.value, 0),
                        action_ids.get(window.agent.action.value, 0),
                        mode_ids.get(window.agent.movement_mode.value, 0),
                    ],
                    "next.reward": float(window.reward_signal),
                    "next.done": frame_index == window_count - 1,
                    "timestamp": float(window.t_start),
                    "frame_index": frame_index,
                    "episode_index": episode_index,
                    "index": global_index,
                    "task_index": task_index,
                    "annotation.scene_caption": window.scene_caption,
                    "annotation.event_types": "|".join(
                        sorted({e.event_type.value for e in window.events})
                    ),
                    "annotation.has_causal_chain": any(
                        e.cause_event_id for e in window.events
                    ),
                    "annotation.confidence": round(confidence, 4),
                }
            )
            global_index += 1

        episode_rows.append(
            {
                "episode_index": episode_index,
                "episode_id": meta.episode_id,
                "tasks": [task],
                "length": window_count,
                "game_title": meta.game_title or "",
                "genre": meta.genre.value,
                "perspective": meta.perspective.value,
                "platform": meta.platform or "",
                "has_engine_telemetry": meta.has_engine_telemetry,
                "contains_real_world_video": meta.consent.contains_real_world_video,
                "commercial_license": meta.consent.commercial_license,
                "source_duration_seconds": float(meta.capture.duration_seconds),
            }
        )

        source_video = video_paths.get(meta.episode_id)
        if source_video and os.path.exists(source_video):
            chunk = episode_index // chunk_size
            rel = VIDEO_PATH_TEMPLATE.format(
                video_key="observation.image", chunk=chunk, file_index=episode_index % chunk_size
            )
            dest = os.path.join(output_dir, rel)
            os.makedirs(os.path.dirname(dest), exist_ok=True)
            shutil.copy2(source_video, dest)
            files_written.append(rel)

    data_rel = DATA_PATH_TEMPLATE.format(chunk=0, file_index=0)
    data_abs = os.path.join(output_dir, data_rel)
    os.makedirs(os.path.dirname(data_abs), exist_ok=True)
    data_schema = pa.schema(
        [
            pa.field("observation.state", pa.list_(pa.float32(), 7)),
            pa.field("action", pa.list_(pa.int64(), 3)),
            pa.field("next.reward", pa.float32()),
            pa.field("next.done", pa.bool_()),
            pa.field("timestamp", pa.float32()),
            pa.field("frame_index", pa.int64()),
            pa.field("episode_index", pa.int64()),
            pa.field("index", pa.int64()),
            pa.field("task_index", pa.int64()),
            pa.field("annotation.scene_caption", pa.string()),
            pa.field("annotation.event_types", pa.string()),
            pa.field("annotation.has_causal_chain", pa.bool_()),
            pa.field("annotation.confidence", pa.float32()),
        ]
    )
    pq.write_table(
        pa.Table.from_pydict(
            {f.name: [r[f.name] for r in data_rows] for f in data_schema},
            schema=data_schema,
        ),
        data_abs,
        compression="zstd",
    )
    files_written.append(data_rel)

    episodes_rel = EPISODES_PATH_TEMPLATE.format(chunk=0, file_index=0)
    episodes_abs = os.path.join(output_dir, episodes_rel)
    os.makedirs(os.path.dirname(episodes_abs), exist_ok=True)
    episodes_schema = pa.schema(
        [
            pa.field("episode_index", pa.int64()),
            pa.field("episode_id", pa.string()),
            pa.field("tasks", pa.list_(pa.string())),
            pa.field("length", pa.int64()),
            pa.field("game_title", pa.string()),
            pa.field("genre", pa.string()),
            pa.field("perspective", pa.string()),
            pa.field("platform", pa.string()),
            pa.field("has_engine_telemetry", pa.bool_()),
            pa.field("contains_real_world_video", pa.bool_()),
            pa.field("commercial_license", pa.bool_()),
            pa.field("source_duration_seconds", pa.float64()),
        ]
    )
    pq.write_table(
        pa.Table.from_pydict(
            {f.name: [r[f.name] for r in episode_rows] for f in episodes_schema},
            schema=episodes_schema,
        ),
        episodes_abs,
        compression="zstd",
    )
    files_written.append(episodes_rel)

    tasks_rel = "meta/tasks.parquet"
    tasks_schema = pa.schema(
        [pa.field("task_index", pa.int64()), pa.field("task", pa.string())]
    )
    pq.write_table(
        pa.Table.from_pydict(
            {
                "task_index": list(tasks.values()),
                "task": list(tasks.keys()),
            },
            schema=tasks_schema,
        ),
        os.path.join(output_dir, tasks_rel),
        compression="zstd",
    )
    files_written.append(tasks_rel)

    info = {
        "codebase_version": "v3.0",
        "robot_type": robot_type,
        "total_episodes": len(allowed),
        "total_frames": len(data_rows),
        "total_tasks": len(tasks),
        "total_videos": sum(1 for f in files_written if f.startswith("videos/")),
        "chunks_size": chunk_size,
        "data_files_size_in_mb": 100,
        "video_files_size_in_mb": 500,
        "fps": fps,
        "splits": {"train": f"0:{len(allowed)}"},
        "data_path": DATA_PATH_TEMPLATE.replace("{chunk:03d}", "{chunk_index:03d}"),
        "video_path": VIDEO_PATH_TEMPLATE.replace("{chunk:03d}", "{chunk_index:03d}"),
        "features": LEROBOT_FEATURES,
        "substream": {
            "annotation_schema": SCHEMA_VERSION,
            "timestep_semantics": (
                "One timestep is one dense annotation window, not one video "
                "frame. fps therefore describes window rate."
            ),
        },
    }
    info_rel = "meta/info.json"
    with open(os.path.join(output_dir, info_rel), "w") as f:
        json.dump(info, f, indent=2)
    files_written.append(info_rel)

    return ExportReport(
        format="lerobot_v3",
        output_path=output_dir,
        episodes_written=len(allowed),
        episodes_skipped_consent=skipped,
        rows_written=len(data_rows),
        files_written=sorted(files_written),
    )


# --------------------------------------------------------------------------
# RLDS / TFDS
# --------------------------------------------------------------------------


def export_rlds(
    episodes: Iterable[Episode],
    output_path: str,
    enforce_consent: bool = True,
) -> ExportReport:
    """Write RLDS-shaped JSONL: one episode per line, each holding a step list.

    JSONL rather than TFRecord on purpose. Writing TFRecord would pull TensorFlow
    into this service's dependency tree for the sake of a secondary export path;
    `tfds.features` reads this shape directly, so the conversion belongs on the
    consumer side.
    """
    allowed, skipped = _partition_by_consent(episodes, enforce_consent)
    cat_ids, action_ids, mode_ids = _action_vocab()
    os.makedirs(os.path.dirname(os.path.abspath(output_path)) or ".", exist_ok=True)

    total_steps = 0
    with open(output_path, "w") as f:
        for episode in allowed:
            steps = []
            count = len(episode.windows)
            for i, window in enumerate(episode.windows):
                steps.append(
                    {
                        "is_first": i == 0,
                        "is_last": i == count - 1,
                        "is_terminal": i == count - 1,
                        "observation": {
                            "timestamp": window.t_start,
                            "camera_motion": window.camera.motion.value,
                            "camera_motion_magnitude": window.camera.motion_magnitude,
                            "perspective": window.camera.perspective.value,
                            "scene_caption": window.scene_caption,
                            "ui_state": window.ui_state.model_dump(mode="json"),
                            "entity_count": len(window.entities),
                        },
                        "action": {
                            "category_id": cat_ids.get(
                                window.agent.action_category.value, 0
                            ),
                            "action_id": action_ids.get(window.agent.action.value, 0),
                            "movement_mode_id": mode_ids.get(
                                window.agent.movement_mode.value, 0
                            ),
                            "action_name": window.agent.action.value,
                            "intent": window.agent.intent,
                        },
                        "reward": window.reward_signal,
                        "discount": 1.0,
                        "language_instruction": (
                            f"Play {episode.metadata.game_title or 'game'}"
                        ),
                    }
                )
            total_steps += len(steps)
            f.write(
                json.dumps(
                    {
                        "episode_metadata": {
                            "episode_id": episode.metadata.episode_id,
                            "game_title": episode.metadata.game_title,
                            "genre": episode.metadata.genre.value,
                            "annotation_schema": SCHEMA_VERSION,
                        },
                        "steps": steps,
                    }
                )
                + "\n"
            )

    return ExportReport(
        format="rlds_jsonl",
        output_path=output_path,
        episodes_written=len(allowed),
        episodes_skipped_consent=skipped,
        rows_written=total_steps,
        files_written=[output_path],
    )


def export_all(
    episodes: list[Episode],
    output_dir: str,
    video_paths: Optional[dict[str, str]] = None,
    enforce_consent: bool = True,
) -> dict[str, Any]:
    """Run every exporter into one directory."""
    os.makedirs(output_dir, exist_ok=True)
    reports = {
        "jsonl": export_jsonl(
            episodes, os.path.join(output_dir, "episodes.jsonl"), enforce_consent
        ),
        "parquet": export_parquet(
            episodes, os.path.join(output_dir, "dense_windows.parquet"), enforce_consent
        ),
        "lerobot_v3": export_lerobot(
            episodes,
            os.path.join(output_dir, "lerobot"),
            video_paths=video_paths,
            enforce_consent=enforce_consent,
        ),
        "rlds": export_rlds(
            episodes, os.path.join(output_dir, "rlds.jsonl"), enforce_consent
        ),
    }
    return {name: report.as_dict() for name, report in reports.items()}
