"""Generate JSONL datasets for Vertex AI video fine-tuning.

Converts collected training examples into the format required by
Vertex AI supervised fine-tuning for Gemini 2.5 Flash video tuning.

Constraints:
- Max 100MB per video file
- Max 20 min per video at MEDIA_RESOLUTION_LOW
- Max 5 min per video at MEDIA_RESOLUTION_MEDIUM
- JSONL format with consistent mediaResolution
"""

from __future__ import annotations

import json
import logging
import os
import subprocess
import uuid
from typing import Any

import config
from training.models import TrainingExample

logger = logging.getLogger(__name__)

MAX_CHUNK_DURATION_LOW_RES = 1200  # 20 min
MAX_CHUNK_DURATION_MED_RES = 300   # 5 min
MAX_CHUNK_SIZE_BYTES = 100 * 1024 * 1024  # 100MB


def _get_video_duration(video_path: str) -> float:
    try:
        result = subprocess.run(
            ["ffprobe", "-v", "quiet", "-show_entries", "format=duration",
             "-of", "default=noprint_wrappers=1:nokey=1", video_path],
            capture_output=True, text=True, check=True,
        )
        return float(result.stdout.strip())
    except Exception:
        return 0.0


def _build_prompt(game_title: str, genre: str) -> str:
    """Build the user prompt for a training example."""
    return (
        f"Watch this gameplay recording from '{game_title}' ({genre} genre) "
        f"and identify the most highlight-worthy moments. "
        f"For each highlight, provide precise timestamps, a score 0-100, "
        f"a short label, and a reason why it is a highlight. "
        f"Return a JSON object with a 'highlights' array."
    )


def _build_model_response(segments: list[dict[str, Any]]) -> str:
    """Build the expected model output for a training example."""
    highlights = []
    for seg in segments:
        highlights.append({
            "start_seconds": seg.get("start", seg.get("start_seconds", 0)),
            "end_seconds": seg.get("end", seg.get("end_seconds", 0)),
            "score": seg.get("score", 80),
            "label": seg.get("label", "highlight"),
            "reason": seg.get("reason", "identified as highlight-worthy"),
        })

    return json.dumps({
        "highlights": highlights,
        "game_detected": "known",
        "genre_detected": "known",
        "overall_energy": "high",
    })


def generate_jsonl_entry(
    example: TrainingExample,
    resolution: str = "MEDIA_RESOLUTION_LOW",
) -> dict[str, Any] | None:
    """Generate a single JSONL entry for Vertex AI video tuning.

    Returns None if the example doesn't have required data.
    """
    video_uri = example.source_video_gcs_uri or example.highlight_video_gcs_uri
    if not video_uri or not example.highlight_segments:
        return None

    prompt = _build_prompt(example.game_title, example.genre)
    model_response = _build_model_response(example.highlight_segments)

    return {
        "contents": [
            {
                "role": "user",
                "parts": [
                    {
                        "fileData": {
                            "fileUri": video_uri,
                            "mimeType": "video/mp4",
                        }
                    },
                    {"text": prompt},
                ],
            },
            {
                "role": "model",
                "parts": [
                    {"text": model_response},
                ],
            },
        ],
        "mediaResolution": resolution,
    }


def export_dataset(
    examples: list[TrainingExample],
    output_dir: str,
    resolution: str = "MEDIA_RESOLUTION_LOW",
    validation_split: float = 0.1,
) -> tuple[str, str]:
    """Export training examples as JSONL files for Vertex AI.

    Returns (train_path, validation_path).
    """
    os.makedirs(output_dir, exist_ok=True)

    entries = []
    for ex in examples:
        entry = generate_jsonl_entry(ex, resolution)
        if entry:
            entries.append(entry)

    if not entries:
        raise ValueError("No valid training examples to export")

    split_idx = max(1, int(len(entries) * (1 - validation_split)))
    train_entries = entries[:split_idx]
    val_entries = entries[split_idx:] if split_idx < len(entries) else entries[-1:]

    train_path = os.path.join(output_dir, "train.jsonl")
    val_path = os.path.join(output_dir, "validation.jsonl")

    with open(train_path, "w") as f:
        for entry in train_entries:
            f.write(json.dumps(entry) + "\n")

    with open(val_path, "w") as f:
        for entry in val_entries:
            f.write(json.dumps(entry) + "\n")

    logger.info(
        "Exported dataset: %d train, %d validation examples to %s",
        len(train_entries), len(val_entries), output_dir,
    )

    return train_path, val_path


def upload_dataset_to_gcs(
    local_path: str,
    dataset_name: str,
) -> str:
    """Upload a JSONL dataset file to GCS and return the gs:// URI."""
    from services.gcs_client import _get_client

    client = _get_client()
    bucket = client.bucket(config.GCS_TRAINING_BUCKET)

    blob_path = f"{config.GCS_TRAINING_PREFIX}/datasets/{dataset_name}/{os.path.basename(local_path)}"
    blob = bucket.blob(blob_path)
    blob.upload_from_filename(local_path, content_type="application/jsonl")

    gcs_uri = f"gs://{config.GCS_TRAINING_BUCKET}/{blob_path}"
    logger.info("Uploaded dataset to %s", gcs_uri)
    return gcs_uri
