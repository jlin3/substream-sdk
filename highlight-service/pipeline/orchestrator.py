"""Main pipeline orchestrator — coordinates all highlight generation steps."""

from __future__ import annotations

import asyncio
import logging
import os
import shutil
import subprocess
import time
from typing import Any

import config
from api.schemas import HighlightSegment, JobMetadata
from pipeline.scene_analysis import analyze_scenes
from pipeline.audio_analysis import analyze_audio
from pipeline.segment_scoring import score_segments
from pipeline.highlight_selection import select_highlights
from pipeline.assembly import assemble_highlight_reel
from services.gcs_client import download_video, upload_highlight, generate_signed_url
from services.s3_client import is_s3_uri, s3_to_gcs

logger = logging.getLogger(__name__)


async def run_pipeline(
    job_id: str,
    video_uri: str,
    target_duration: int,
    game_title: str | None = None,
) -> dict[str, Any]:
    """Run the full highlight generation pipeline.

    Returns a dict with highlight_url, segments, and metadata.
    """
    start_time = time.time()
    work_dir = os.path.join(config.TEMP_DIR, job_id)
    os.makedirs(work_dir, exist_ok=True)

    try:
        return await _execute(job_id, video_uri, target_duration, game_title, work_dir, start_time)
    finally:
        shutil.rmtree(work_dir, ignore_errors=True)


async def _execute(
    job_id: str,
    video_uri: str,
    target_duration: int,
    game_title: str | None,
    work_dir: str,
    start_time: float,
) -> dict[str, Any]:
    loop = asyncio.get_running_loop()

    # --- Step 1: Download source video ---
    logger.info("[%s] Step 1/6: Downloading source video", job_id)

    # S3 URIs need to be bridged to GCS for Video Intelligence
    gcs_uri_for_analysis = video_uri
    if is_s3_uri(video_uri):
        logger.info("[%s] S3 source detected — bridging to GCS", job_id)
        video_path, gcs_uri_for_analysis = await loop.run_in_executor(
            None, s3_to_gcs, video_uri, job_id, work_dir,
        )
    else:
        video_path = await loop.run_in_executor(None, download_video, video_uri, work_dir)

    # --- Step 2 & 3: Scene analysis and audio analysis (in parallel) ---
    logger.info("[%s] Steps 2-3: Running scene + audio analysis in parallel", job_id)
    scene_future = loop.run_in_executor(None, analyze_scenes, gcs_uri_for_analysis)
    audio_future = loop.run_in_executor(None, analyze_audio, video_path, work_dir)

    scene_result, audio_result = await asyncio.gather(scene_future, audio_future)

    video_duration = scene_result.video_duration
    if video_duration <= 0:
        video_duration = _get_duration_ffprobe(video_path)
        scene_result.video_duration = video_duration
        logger.info("[%s] Video Intelligence returned 0s duration; ffprobe says %.1fs", job_id, video_duration)

    if video_duration < config.MIN_VIDEO_DURATION_SECONDS:
        raise ValueError(
            f"Video too short ({video_duration:.0f}s). "
            f"Minimum is {config.MIN_VIDEO_DURATION_SECONDS}s."
        )
    if video_duration > config.MAX_VIDEO_DURATION_SECONDS:
        raise ValueError(
            f"Video too long ({video_duration:.0f}s). "
            f"Maximum is {config.MAX_VIDEO_DURATION_SECONDS}s."
        )

    # --- Step 4: Score segments with Gemini ---
    logger.info("[%s] Step 4/6: Scoring segments with Gemini", job_id)
    scored = await loop.run_in_executor(
        None, score_segments, video_path, scene_result, audio_result, work_dir, game_title,
    )

    # --- Step 5: Select highlights ---
    logger.info("[%s] Step 5/6: Selecting highlight segments", job_id)
    selected = select_highlights(scored, float(target_duration), video_duration)

    if not selected:
        raise ValueError("Could not select any highlight segments from this video")

    # --- Step 6: Assemble highlight reel ---
    logger.info("[%s] Step 6/6: Assembling highlight reel", job_id)
    output_path = os.path.join(work_dir, f"{job_id}_highlight.mp4")
    assemble_highlight_reel(video_path, selected, output_path, work_dir)

    # --- Upload and generate URL ---
    session_id = _extract_session_id(video_uri)
    gcs_uri = await loop.run_in_executor(
        None, upload_highlight, output_path, session_id, job_id,
    )
    signed_url = generate_signed_url(gcs_uri)

    elapsed = time.time() - start_time
    highlight_duration = sum(s.duration for s in selected)

    logger.info(
        "[%s] Pipeline complete in %.1fs — %d segments, %.1fs highlight",
        job_id, elapsed, len(selected), highlight_duration,
    )

    return {
        "highlight_url": signed_url,
        "segments": [
            HighlightSegment(
                start_time=s.start_time,
                end_time=s.end_time,
                duration=s.duration,
                score=s.score,
                label=s.label,
            )
            for s in selected
        ],
        "metadata": JobMetadata(
            source_duration=video_duration,
            highlight_duration=highlight_duration,
            segments_analyzed=len(scored),
            segments_selected=len(selected),
            processing_time_seconds=round(elapsed, 1),
        ),
    }


def _get_duration_ffprobe(video_path: str) -> float:
    """Get video duration in seconds using ffprobe."""
    try:
        result = subprocess.run(
            ["ffprobe", "-v", "quiet", "-show_entries", "format=duration",
             "-of", "default=noprint_wrappers=1:nokey=1", video_path],
            capture_output=True, text=True, check=True,
        )
        return float(result.stdout.strip())
    except Exception:
        logger.warning("ffprobe duration detection failed for %s", video_path)
        return 0.0


def _extract_session_id(video_uri: str) -> str:
    """Best-effort extraction of a session ID from the GCS path.

    Expects paths like gs://bucket/vr-recordings/{session_id}/file.webm
    Falls back to 'unknown' if the pattern doesn't match.
    """
    parts = video_uri.replace("gs://", "").split("/")
    if len(parts) >= 3:
        return parts[-2]
    return "unknown"
