"""API routes for training data collection, dataset export, and fine-tuning.

Provides endpoints for:
- Uploading labeled highlight examples (video + metadata)
- Listing collected training examples
- Exporting as Vertex AI JSONL datasets
- Launching and monitoring fine-tuning jobs
"""

from __future__ import annotations

import json
import logging
import os
import uuid
from typing import Any, Optional

from fastapi import APIRouter, File, Form, HTTPException, UploadFile

import config
from api.schemas import TrainingExampleResponse, TrainingExampleUpload
from training.models import TrainingExample

logger = logging.getLogger(__name__)
router = APIRouter()

_examples_store: dict[str, TrainingExample] = {}

_METADATA_PATH = os.path.join(config.TEMP_DIR, "training_examples.json")


def _load_examples():
    """Load examples from persistent JSON file."""
    if os.path.exists(_METADATA_PATH):
        try:
            with open(_METADATA_PATH) as f:
                data = json.load(f)
            for item in data:
                ex = TrainingExample.from_dict(item)
                _examples_store[ex.id] = ex
        except Exception:
            logger.warning("Failed to load training examples from %s", _METADATA_PATH)


def _save_examples():
    """Persist examples to JSON file."""
    os.makedirs(os.path.dirname(_METADATA_PATH), exist_ok=True)
    data = [ex.to_dict() for ex in _examples_store.values()]
    with open(_METADATA_PATH, "w") as f:
        json.dump(data, f, indent=2)


_load_examples()


@router.post("/training/upload", response_model=TrainingExampleResponse)
async def upload_training_example(
    file: UploadFile = File(...),
    game_title: str = Form(...),
    genre: str = Form("other"),
    source_video_uri: Optional[str] = Form(None),
    highlight_segments_json: Optional[str] = Form(None),
):
    """Upload a highlight video as a training example.

    The uploaded file is the highlight reel (positive example).
    Optionally provide the source video URI and labeled segments.
    """
    example_id = str(uuid.uuid4())

    raw_name = file.filename or "video.mp4"
    ext = raw_name.rsplit(".", 1)[-1] if "." in raw_name else "mp4"
    ext = ext[:10].replace("/", "").replace("\\", "").replace("..", "")
    filename = f"{example_id}.{ext}"

    max_upload_bytes = 500 * 1024 * 1024  # 500 MB
    contents = await file.read()
    if len(contents) > max_upload_bytes:
        raise HTTPException(status_code=413, detail=f"File too large ({len(contents)} bytes). Max is {max_upload_bytes} bytes.")

    from services.gcs_client import _get_client
    client = _get_client()
    bucket = client.bucket(config.GCS_TRAINING_BUCKET)
    blob_path = f"{config.GCS_TRAINING_PREFIX}/examples/{example_id}/{filename}"
    blob = bucket.blob(blob_path)

    content_type = "video/mp4"
    if filename.endswith(".webm"):
        content_type = "video/webm"
    elif filename.endswith(".mov"):
        content_type = "video/quicktime"

    blob.upload_from_string(contents, content_type=content_type)
    highlight_gcs_uri = f"gs://{config.GCS_TRAINING_BUCKET}/{blob_path}"

    segments = None
    if highlight_segments_json:
        try:
            segments = json.loads(highlight_segments_json)
        except json.JSONDecodeError:
            raise HTTPException(status_code=400, detail="Invalid JSON in highlight_segments_json")
        if not isinstance(segments, list):
            raise HTTPException(status_code=400, detail="highlight_segments_json must be a JSON array")
        for i, seg in enumerate(segments):
            if not isinstance(seg, dict):
                raise HTTPException(status_code=400, detail=f"Segment {i} must be a JSON object")
            if "start" not in seg and "start_seconds" not in seg:
                raise HTTPException(status_code=400, detail=f"Segment {i} must have 'start' or 'start_seconds'")
            if "end" not in seg and "end_seconds" not in seg:
                raise HTTPException(status_code=400, detail=f"Segment {i} must have 'end' or 'end_seconds'")

    example = TrainingExample(
        id=example_id,
        source_video_gcs_uri=source_video_uri,
        highlight_video_gcs_uri=highlight_gcs_uri,
        highlight_segments=segments,
        game_title=game_title,
        genre=genre,
        metadata={"filename": filename, "size_bytes": len(contents)},
    )

    _examples_store[example_id] = example
    _save_examples()

    logger.info("Stored training example %s (game=%s, genre=%s)", example_id, game_title, genre)

    return TrainingExampleResponse(
        id=example_id,
        game_title=game_title,
        genre=genre,
        source_video_gcs_uri=source_video_uri,
        highlight_video_gcs_uri=highlight_gcs_uri,
        highlight_segments=segments,
        created_at=example.created_at,
    )


@router.post("/training/metadata", response_model=TrainingExampleResponse)
async def add_training_metadata(body: TrainingExampleUpload):
    """Add a training example from metadata only (no file upload).

    Useful for recording labeled segments from existing GCS videos.
    """
    example_id = str(uuid.uuid4())

    example = TrainingExample(
        id=example_id,
        source_video_gcs_uri=body.source_video_uri,
        highlight_video_gcs_uri=None,
        highlight_segments=body.highlight_segments,
        game_title=body.game_title,
        genre=body.genre,
    )

    _examples_store[example_id] = example
    _save_examples()

    return TrainingExampleResponse(
        id=example_id,
        game_title=body.game_title,
        genre=body.genre,
        source_video_gcs_uri=body.source_video_uri,
        highlight_segments=body.highlight_segments,
        created_at=example.created_at,
    )


@router.get("/training/examples", response_model=list[TrainingExampleResponse])
async def list_training_examples(game_title: Optional[str] = None, genre: Optional[str] = None):
    """List all training examples, optionally filtered by game or genre."""
    examples = list(_examples_store.values())

    if game_title:
        examples = [e for e in examples if e.game_title.lower() == game_title.lower()]
    if genre:
        examples = [e for e in examples if e.genre.lower() == genre.lower()]

    examples.sort(key=lambda e: e.created_at, reverse=True)

    return [
        TrainingExampleResponse(
            id=e.id,
            game_title=e.game_title,
            genre=e.genre,
            source_video_gcs_uri=e.source_video_gcs_uri,
            highlight_video_gcs_uri=e.highlight_video_gcs_uri,
            highlight_segments=e.highlight_segments,
            created_at=e.created_at,
        )
        for e in examples
    ]


@router.post("/training/export")
async def export_dataset(resolution: str = "MEDIA_RESOLUTION_LOW"):
    """Export training examples as a Vertex AI JSONL dataset and upload to GCS."""
    from training.dataset import export_dataset as do_export, upload_dataset_to_gcs

    examples = list(_examples_store.values())
    valid = [e for e in examples if e.highlight_segments and (e.source_video_gcs_uri or e.highlight_video_gcs_uri)]

    if len(valid) < 10:
        raise HTTPException(
            status_code=400,
            detail=f"Need at least 10 examples with segments and video URIs. Have {len(valid)}.",
        )

    export_dir = os.path.join(config.TEMP_DIR, "dataset_export")
    train_path, val_path = do_export(valid, export_dir, resolution)

    dataset_name = f"highlight-{uuid.uuid4().hex[:8]}"
    train_uri = upload_dataset_to_gcs(train_path, dataset_name)
    val_uri = upload_dataset_to_gcs(val_path, dataset_name)

    return {
        "dataset_name": dataset_name,
        "train_uri": train_uri,
        "validation_uri": val_uri,
        "train_examples": len(valid) - max(1, int(len(valid) * 0.1)),
        "validation_examples": max(1, int(len(valid) * 0.1)),
    }


@router.post("/training/tune")
async def launch_tuning(
    train_uri: str,
    validation_uri: str,
    display_name: str = "highlight-scorer",
    source_model: str = "gemini-2.5-flash-001",
):
    """Launch a Vertex AI supervised fine-tuning job."""
    from training.tuner import launch_tuning_job

    result = launch_tuning_job(
        train_dataset_uri=train_uri,
        validation_dataset_uri=validation_uri,
        display_name=display_name,
        source_model=source_model,
    )

    if result.status == "failed":
        raise HTTPException(status_code=500, detail=f"Tuning job failed: {result.error}")

    return {
        "job_name": result.job_name,
        "status": result.status,
    }


@router.get("/training/tune/{job_name:path}")
async def get_tuning_status(job_name: str):
    """Check the status of a fine-tuning job."""
    from training.tuner import get_tuning_job_status

    result = get_tuning_job_status(job_name)

    return {
        "job_name": result.job_name,
        "status": result.status,
        "model_name": result.model_name,
        "error": result.error,
    }
