from __future__ import annotations

import time
import uuid
import logging
from typing import Any, Optional

from fastapi import APIRouter, BackgroundTasks, File, Form, HTTPException, UploadFile

from api.schemas import (
    HighlightCreateResponse,
    HighlightRequest,
    HighlightResponse,
    JobStatus,
)
def _import_pipeline():
    from pipeline.orchestrator import run_pipeline
    return run_pipeline


def _import_gcs_upload():
    from services.gcs_client import upload_raw_video
    return upload_raw_video

logger = logging.getLogger(__name__)
router = APIRouter()

JOB_TTL_SECONDS = 3600

jobs: dict[str, dict[str, Any]] = {}


def _cleanup_expired_jobs():
    """Remove jobs older than JOB_TTL_SECONDS to prevent unbounded memory growth."""
    now = time.time()
    expired = [
        jid for jid, data in jobs.items()
        if now - data.get("created_at", now) > JOB_TTL_SECONDS
        and data["status"] in (JobStatus.COMPLETED, JobStatus.FAILED)
    ]
    for jid in expired:
        del jobs[jid]
    if expired:
        logger.info("Cleaned up %d expired jobs", len(expired))


@router.post("/highlights", response_model=HighlightCreateResponse)
async def create_highlight(request: HighlightRequest, background_tasks: BackgroundTasks):
    """Kick off async highlight generation for a gameplay video."""
    _cleanup_expired_jobs()
    job_id = str(uuid.uuid4())

    jobs[job_id] = {
        "status": JobStatus.PENDING,
        "request": request.model_dump(),
        "created_at": time.time(),
    }

    background_tasks.add_task(_run_job, job_id, request.video_uri, request.target_duration_seconds, request.game_title)

    logger.info("Created highlight job %s for %s", job_id, request.video_uri)
    return HighlightCreateResponse(job_id=job_id, status=JobStatus.PENDING)


@router.post("/highlights/upload", response_model=HighlightCreateResponse)
async def upload_and_create_highlight(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    target_duration_seconds: int = Form(90),
    game_title: Optional[str] = Form(None),
):
    """Upload a video file and kick off highlight generation."""
    _cleanup_expired_jobs()

    allowed_types = {"video/", "application/octet-stream", "application/mp4"}
    if file.content_type and not any(file.content_type.startswith(t) for t in allowed_types):
        raise HTTPException(status_code=400, detail=f"Expected a video file, got {file.content_type}")

    job_id = str(uuid.uuid4())
    filename = file.filename or f"{job_id}.mp4"

    contents = await file.read()
    upload_raw_video = _import_gcs_upload()
    gcs_uri = upload_raw_video(contents, job_id, filename)

    jobs[job_id] = {
        "status": JobStatus.PENDING,
        "request": {
            "video_uri": gcs_uri,
            "target_duration_seconds": target_duration_seconds,
            "game_title": game_title,
        },
        "created_at": time.time(),
    }

    background_tasks.add_task(_run_job, job_id, gcs_uri, target_duration_seconds, game_title)

    logger.info("Uploaded file and created highlight job %s", job_id)
    return HighlightCreateResponse(job_id=job_id, status=JobStatus.PENDING)


@router.get("/highlights", response_model=list[HighlightResponse])
async def list_highlights():
    """List all highlight jobs."""
    _cleanup_expired_jobs()
    return [
        HighlightResponse(
            job_id=jid,
            status=data["status"],
            highlight_url=data.get("highlight_url"),
            segments=data.get("segments"),
            metadata=data.get("metadata"),
            error=data.get("error"),
        )
        for jid, data in sorted(jobs.items(), key=lambda x: x[1].get("created_at", 0), reverse=True)
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
    job = jobs.get(job_id)
    if not job:
        raise HTTPException(status_code=404, detail=f"Job {job_id} not found")

    return HighlightResponse(
        job_id=job_id,
        status=job["status"],
        highlight_url=job.get("highlight_url"),
        segments=job.get("segments"),
        metadata=job.get("metadata"),
        error=job.get("error"),
    )


async def _run_job(job_id: str, video_uri: str, target_duration: int, game_title: str | None):
    """Execute the highlight pipeline as a background task."""
    jobs[job_id]["status"] = JobStatus.PROCESSING

    try:
        run_pipeline = _import_pipeline()
        result = await run_pipeline(
            job_id=job_id,
            video_uri=video_uri,
            target_duration=target_duration,
            game_title=game_title,
        )

        jobs[job_id].update({
            "status": JobStatus.COMPLETED,
            "highlight_url": result["highlight_url"],
            "segments": result["segments"],
            "metadata": result["metadata"],
        })
        logger.info("Job %s completed successfully", job_id)

    except Exception as exc:
        logger.exception("Job %s failed", job_id)
        jobs[job_id].update({
            "status": JobStatus.FAILED,
            "error": str(exc) or "Highlight generation failed. Check service logs for details.",
        })
