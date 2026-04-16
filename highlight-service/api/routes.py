"""API routes for highlight generation, feedback, and job management.

Upgraded with:
- Persistent job storage (Phase 5b)
- Webhook callback support (Phase 5d)
- Human feedback collection (Phase 4b)
- Output preset support (Phase 5a)
"""

from __future__ import annotations

import logging
import time
import uuid
from typing import Any, Optional

import httpx
from fastapi import APIRouter, BackgroundTasks, File, Form, HTTPException, UploadFile

from api.schemas import (
    FeedbackRequest,
    FeedbackResponse,
    HighlightCreateResponse,
    HighlightRequest,
    HighlightResponse,
    JobStatus,
)
from services.job_store import create_job_store


def _import_pipeline():
    from pipeline.orchestrator import run_pipeline
    return run_pipeline


def _import_gcs_upload():
    from services.gcs_client import upload_raw_video
    return upload_raw_video


logger = logging.getLogger(__name__)
router = APIRouter()

JOB_TTL_SECONDS = 3600

store = create_job_store()


@router.post("/highlights", response_model=HighlightCreateResponse)
async def create_highlight(request: HighlightRequest, background_tasks: BackgroundTasks):
    """Kick off async highlight generation for a gameplay video."""
    store.cleanup_expired(JOB_TTL_SECONDS)
    job_id = str(uuid.uuid4())

    store.set(job_id, {
        "status": JobStatus.PENDING,
        "request": request.model_dump(),
        "created_at": time.time(),
    })

    background_tasks.add_task(
        _run_job, job_id, request.video_uri, request.target_duration_seconds,
        request.game_title, request.output_preset.value, request.callback_url,
    )

    logger.info("Created highlight job %s for %s", job_id, request.video_uri)
    return HighlightCreateResponse(job_id=job_id, status=JobStatus.PENDING)


@router.post("/highlights/upload", response_model=HighlightCreateResponse)
async def upload_and_create_highlight(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    target_duration_seconds: int = Form(90),
    game_title: Optional[str] = Form(None),
    output_preset: str = Form("standard"),
    callback_url: Optional[str] = Form(None),
):
    """Upload a video file and kick off highlight generation."""
    store.cleanup_expired(JOB_TTL_SECONDS)

    allowed_types = {"video/", "application/octet-stream", "application/mp4"}
    if file.content_type and not any(file.content_type.startswith(t) for t in allowed_types):
        raise HTTPException(status_code=400, detail=f"Expected a video file, got {file.content_type}")

    job_id = str(uuid.uuid4())
    filename = file.filename or f"{job_id}.mp4"

    contents = await file.read()
    upload_raw_video = _import_gcs_upload()
    gcs_uri = upload_raw_video(contents, job_id, filename)

    store.set(job_id, {
        "status": JobStatus.PENDING,
        "request": {
            "video_uri": gcs_uri,
            "target_duration_seconds": target_duration_seconds,
            "game_title": game_title,
            "output_preset": output_preset,
        },
        "created_at": time.time(),
    })

    background_tasks.add_task(
        _run_job, job_id, gcs_uri, target_duration_seconds,
        game_title, output_preset, callback_url,
    )

    logger.info("Uploaded file and created highlight job %s", job_id)
    return HighlightCreateResponse(job_id=job_id, status=JobStatus.PENDING)


@router.get("/highlights", response_model=list[HighlightResponse])
async def list_highlights():
    """List all highlight jobs."""
    store.cleanup_expired(JOB_TTL_SECONDS)
    items = store.list_all(limit=50)

    return [
        HighlightResponse(
            job_id=jid,
            status=data["status"],
            highlight_url=data.get("highlight_url"),
            segments=data.get("segments"),
            metadata=data.get("metadata"),
            pipeline_data=data.get("pipeline_data"),
            error=data.get("error"),
        )
        for jid, data in items
    ]


@router.get("/signed-url")
async def get_signed_url(uri: str):
    """Generate a signed download URL for a GCS object."""
    if not uri.startswith("gs://"):
        raise HTTPException(status_code=400, detail="URI must start with gs://")
    from services.gcs_client import generate_signed_url
    try:
        url = generate_signed_url(uri, expiry_seconds=86400)
        return {"url": url}
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))


@router.get("/highlights/{job_id}", response_model=HighlightResponse)
async def get_highlight(job_id: str):
    """Poll for highlight generation status and results."""
    job = store.get(job_id)
    if not job:
        raise HTTPException(status_code=404, detail=f"Job {job_id} not found")

    return HighlightResponse(
        job_id=job_id,
        status=job["status"],
        highlight_url=job.get("highlight_url"),
        segments=job.get("segments"),
        metadata=job.get("metadata"),
        pipeline_data=job.get("pipeline_data"),
        error=job.get("error"),
    )


@router.post("/highlights/{job_id}/feedback", response_model=FeedbackResponse)
async def submit_feedback(job_id: str, request: FeedbackRequest):
    """Submit quality feedback for a completed highlight job.

    Feedback is stored alongside the job and can be used to generate
    training data for fine-tuning.
    """
    job = store.get(job_id)
    if not job:
        raise HTTPException(status_code=404, detail=f"Job {job_id} not found")

    feedback_entry = {
        "rating": request.rating.value,
        "notes": request.notes,
        "segment_index": request.segment_index,
        "timestamp": time.time(),
    }

    existing_feedback = job.get("feedback", [])
    if not isinstance(existing_feedback, list):
        existing_feedback = []
    existing_feedback.append(feedback_entry)

    store.update(job_id, {"feedback": existing_feedback})

    if request.rating.value == "good" and job.get("status") == JobStatus.COMPLETED:
        _record_as_training_example(job_id, job, feedback_entry)

    logger.info("Feedback recorded for job %s: %s", job_id, request.rating.value)
    return FeedbackResponse(job_id=job_id, rating=request.rating)


def _record_as_training_example(job_id: str, job: dict, feedback: dict):
    """Auto-create a training example from positively-rated highlight jobs."""
    try:
        from training.models import TrainingExample
        from training.routes import _examples_store, _save_examples

        request_data = job.get("request", {})
        segments = job.get("segments")
        if not segments:
            return

        segment_data = []
        for seg in segments:
            if hasattr(seg, "model_dump"):
                segment_data.append(seg.model_dump())
            elif isinstance(seg, dict):
                segment_data.append(seg)

        metadata = job.get("metadata", {})
        game_title = "unknown"
        genre = "other"
        if hasattr(metadata, "game_detected"):
            game_title = metadata.game_detected or "unknown"
            genre = metadata.genre_detected or "other"
        elif isinstance(metadata, dict):
            game_title = metadata.get("game_detected", request_data.get("game_title", "unknown"))
            genre = metadata.get("genre_detected", "other")

        example = TrainingExample(
            id=f"feedback-{job_id}",
            source_video_gcs_uri=request_data.get("video_uri"),
            highlight_video_gcs_uri=None,
            highlight_segments=segment_data,
            game_title=game_title,
            genre=genre,
            feedback_rating=feedback["rating"],
            feedback_notes=feedback.get("notes"),
        )

        _examples_store[example.id] = example
        _save_examples()
        logger.info("Auto-recorded training example from feedback: %s", example.id)
    except Exception:
        logger.warning("Failed to record training example from feedback", exc_info=True)


async def _run_job(
    job_id: str,
    video_uri: str,
    target_duration: int,
    game_title: str | None,
    output_preset: str = "standard",
    callback_url: str | None = None,
):
    """Execute the highlight pipeline as a background task."""
    store.update(job_id, {"status": JobStatus.PROCESSING})

    try:
        run_pipeline = _import_pipeline()
        result = await run_pipeline(
            job_id=job_id,
            video_uri=video_uri,
            target_duration=target_duration,
            game_title=game_title,
            output_preset=output_preset,
        )

        store.update(job_id, {
            "status": JobStatus.COMPLETED,
            "highlight_url": result["highlight_url"],
            "segments": result["segments"],
            "metadata": result["metadata"],
            "pipeline_data": result.get("pipeline_data"),
        })
        logger.info("Job %s completed successfully", job_id)

        if callback_url:
            await _send_webhook(callback_url, job_id, "completed", result)

    except Exception as exc:
        logger.exception("Job %s failed", job_id)
        store.update(job_id, {
            "status": JobStatus.FAILED,
            "error": str(exc) or "Highlight generation failed. Check service logs for details.",
        })

        if callback_url:
            await _send_webhook(callback_url, job_id, "failed", {"error": str(exc)})


async def _send_webhook(callback_url: str, job_id: str, status: str, data: dict):
    """POST job results to the callback URL."""
    payload = {
        "job_id": job_id,
        "status": status,
        **data,
    }
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.post(callback_url, json=payload)
            logger.info("Webhook sent to %s: status=%d", callback_url, response.status_code)
    except Exception:
        logger.warning("Webhook delivery failed for %s", callback_url, exc_info=True)
