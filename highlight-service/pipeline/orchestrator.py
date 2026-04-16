"""Main pipeline orchestrator — coordinates all highlight generation steps.

Upgraded pipeline flow:
1. Download source video
2. Parallel: Gemini whole-video discovery + Video Intelligence API + Audio analysis
3. Merge candidates: snap Gemini timestamps to VI shot boundaries, enrich with signals
4. Verify top segments: send video clips to Gemini for refined scoring
5. Narrative-aware selection
6. Smart FFmpeg assembly
7. Quality self-review (optional retry)
8. Upload and deliver
"""

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
from pipeline.scene_analysis import SceneAnalysisResult, analyze_scenes
from pipeline.audio_analysis import AudioAnalysisResult, analyze_audio
from pipeline.segment_scoring import ScoredSegment
from pipeline.highlight_selection import select_highlights
from pipeline.assembly import assemble_highlight_reel
from services.gcs_client import download_video, upload_highlight, generate_signed_url
from services.s3_client import is_s3_uri, s3_to_gcs
from services.gemini_video_client import (
    discover_highlights,
    verify_segment,
    VideoDiscoveryResult,
    DiscoveredHighlight,
)

logger = logging.getLogger(__name__)


async def run_pipeline(
    job_id: str,
    video_uri: str,
    target_duration: int,
    game_title: str | None = None,
    output_preset: str = "standard",
    callback_url: str | None = None,
) -> dict[str, Any]:
    """Run the full highlight generation pipeline.

    Returns a dict with highlight_url, segments, metadata, and pipeline_data.
    """
    start_time = time.time()
    work_dir = os.path.join(config.TEMP_DIR, job_id)
    os.makedirs(work_dir, exist_ok=True)

    try:
        return await _execute(
            job_id, video_uri, target_duration, game_title,
            output_preset, work_dir, start_time,
        )
    finally:
        shutil.rmtree(work_dir, ignore_errors=True)


async def _execute(
    job_id: str,
    video_uri: str,
    target_duration: int,
    game_title: str | None,
    output_preset: str,
    work_dir: str,
    start_time: float,
) -> dict[str, Any]:
    loop = asyncio.get_running_loop()

    # --- Step 1: Download source video ---
    logger.info("[%s] Step 1: Downloading source video", job_id)

    gcs_uri_for_analysis = video_uri
    if is_s3_uri(video_uri):
        logger.info("[%s] S3 source detected — bridging to GCS", job_id)
        video_path, gcs_uri_for_analysis = await loop.run_in_executor(
            None, s3_to_gcs, video_uri, job_id, work_dir,
        )
    else:
        video_path = await loop.run_in_executor(None, download_video, video_uri, work_dir)

    # --- Step 2: Parallel analysis (Gemini discovery + VI + Audio) ---
    logger.info("[%s] Step 2: Running Gemini discovery + VI + audio in parallel", job_id)

    discovery_future = loop.run_in_executor(
        None, discover_highlights, gcs_uri_for_analysis, target_duration, game_title,
    )
    scene_future = loop.run_in_executor(None, analyze_scenes, gcs_uri_for_analysis)
    audio_future = loop.run_in_executor(None, analyze_audio, video_path, work_dir)

    discovery_result, scene_result, audio_result = await asyncio.gather(
        discovery_future, scene_future, audio_future,
    )

    video_duration = scene_result.video_duration
    if video_duration <= 0:
        video_duration = _get_duration_ffprobe(video_path)
        scene_result.video_duration = video_duration
        logger.info("[%s] VI returned 0s duration; ffprobe says %.1fs", job_id, video_duration)

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

    # --- Step 3: Merge candidates ---
    logger.info("[%s] Step 3: Merging Gemini + VI + audio signals", job_id)
    merged = _merge_candidates(discovery_result, scene_result, audio_result, video_duration)
    logger.info("[%s] Merged %d candidates", job_id, len(merged))

    # --- Step 4: Verify top segments ---
    logger.info("[%s] Step 4: Verifying top segments with Gemini", job_id)
    game_title_resolved = game_title or discovery_result.game_detected
    genre = discovery_result.genre_detected

    verified = await _verify_top_segments(
        merged, video_path, work_dir, target_duration, game_title_resolved, genre, loop,
    )
    logger.info("[%s] Verified %d segments", job_id, len(verified))

    # --- Step 5: Narrative-aware selection ---
    logger.info("[%s] Step 5: Selecting highlights (narrative-aware)", job_id)
    selected = select_highlights(verified, float(target_duration), video_duration)

    if not selected:
        raise ValueError("Could not select any highlight segments from this video")

    # --- Step 6: Assemble highlight reel ---
    logger.info("[%s] Step 6: Assembling highlight reel (preset=%s)", job_id, output_preset)
    output_path = os.path.join(work_dir, f"{job_id}_highlight.mp4")
    assemble_highlight_reel(video_path, selected, output_path, work_dir, preset=output_preset)

    # --- Step 7: Quality review ---
    review_score = None
    review_notes = None
    try:
        from pipeline.quality_review import review_highlight_reel
        review_score, review_notes = review_highlight_reel(output_path)
        logger.info("[%s] Quality review score: %d", job_id, review_score)

        if review_score < config.QUALITY_REVIEW_THRESHOLD and config.QUALITY_REVIEW_MAX_RETRIES > 0:
            logger.info("[%s] Below threshold (%d), re-selecting with boosted diversity", job_id, config.QUALITY_REVIEW_THRESHOLD)
            selected = select_highlights(
                verified, float(target_duration), video_duration, boost_diversity=True,
            )
            if selected:
                output_path_retry = os.path.join(work_dir, f"{job_id}_highlight_v2.mp4")
                assemble_highlight_reel(video_path, selected, output_path_retry, work_dir, preset=output_preset)
                retry_score, retry_notes = review_highlight_reel(output_path_retry)
                if retry_score > review_score:
                    output_path = output_path_retry
                    review_score = retry_score
                    review_notes = retry_notes
                    logger.info("[%s] Retry improved score to %d", job_id, review_score)
    except Exception:
        logger.warning("[%s] Quality review failed, proceeding without", job_id, exc_info=True)

    # --- Step 8: Upload and generate URL ---
    session_id = _extract_session_id(video_uri)
    gcs_uri = await loop.run_in_executor(
        None, upload_highlight, output_path, session_id, job_id,
    )
    signed_url = generate_signed_url(gcs_uri)

    elapsed = time.time() - start_time
    highlight_duration = sum(s.duration for s in selected)

    model_used = config.GEMINI_TUNED_MODEL or config.GEMINI_DISCOVERY_MODEL

    logger.info(
        "[%s] Pipeline complete in %.1fs — %d segments, %.1fs highlight (model=%s)",
        job_id, elapsed, len(selected), highlight_duration, model_used,
    )

    pipeline_data = {
        "steps": [
            {"name": "download", "status": "completed"},
            {"name": "gemini_discovery", "status": "completed", "highlights_found": len(discovery_result.highlights)},
            {"name": "video_intelligence", "status": "completed", "shots": len(scene_result.shots)},
            {"name": "audio_analysis", "status": "completed", "peaks": len(audio_result.peaks)},
            {"name": "merge_candidates", "status": "completed", "candidates": len(merged)},
            {"name": "verify_segments", "status": "completed", "verified": len(verified)},
            {"name": "selection", "status": "completed", "selected": len(selected)},
            {"name": "assembly", "status": "completed"},
            {"name": "quality_review", "status": "completed" if review_score is not None else "skipped",
             "score": review_score, "notes": review_notes},
        ],
        "model": model_used,
        "game_detected": discovery_result.game_detected,
        "genre_detected": discovery_result.genre_detected,
        "overall_energy": discovery_result.overall_energy,
    }

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
            segments_analyzed=len(merged),
            segments_selected=len(selected),
            processing_time_seconds=round(elapsed, 1),
            model_used=model_used,
            game_detected=discovery_result.game_detected,
            genre_detected=discovery_result.genre_detected,
            review_score=review_score,
        ),
        "pipeline_data": pipeline_data,
    }


def _merge_candidates(
    discovery: VideoDiscoveryResult,
    scene: SceneAnalysisResult,
    audio: AudioAnalysisResult,
    video_duration: float,
) -> list[ScoredSegment]:
    """Merge Gemini whole-video highlights with VI and audio signals.

    For each Gemini highlight candidate:
    - Snap timestamps to nearest VI shot boundaries for cleaner cuts
    - Compute VI enrichment score from overlapping labels/texts/objects
    - Compute audio energy score for the segment
    """
    from pipeline.segment_scoring import _compute_video_intel_score, _get_audio_score_for_segment
    from pipeline.scene_analysis import ShotBoundary

    merged: list[ScoredSegment] = []

    for h in discovery.highlights:
        start = h.start_seconds
        end = h.end_seconds

        start, end = _snap_to_shot_boundaries(start, end, scene.shots)

        start = max(0.0, min(start, video_duration))
        end = max(start + 1.0, min(end, video_duration))
        duration = end - start

        if duration < 2.0:
            continue

        shot_proxy = ShotBoundary(start_time=start, end_time=end, duration=duration)
        vi_score = _compute_video_intel_score(shot_proxy, scene)
        audio_score = _get_audio_score_for_segment(start, end, audio)

        merged.append(ScoredSegment(
            start_time=start,
            end_time=end,
            duration=duration,
            gemini_score=h.score,
            video_intel_score=vi_score,
            audio_score=audio_score,
            label=h.label,
            reason=h.reason,
            pacing="intense",
        ))

    return merged


def _snap_to_shot_boundaries(
    start: float,
    end: float,
    shots: list,
    snap_tolerance: float = 2.0,
) -> tuple[float, float]:
    """Snap start/end to the nearest VI shot boundary within tolerance."""
    if not shots:
        return start, end

    best_start = start
    best_start_dist = snap_tolerance + 1
    best_end = end
    best_end_dist = snap_tolerance + 1

    for shot in shots:
        d_start = abs(shot.start_time - start)
        if d_start < best_start_dist:
            best_start = shot.start_time
            best_start_dist = d_start

        d_end_to_shot_end = abs(shot.end_time - end)
        if d_end_to_shot_end < best_end_dist:
            best_end = shot.end_time
            best_end_dist = d_end_to_shot_end

    snapped_start = best_start if best_start_dist <= snap_tolerance else start
    snapped_end = best_end if best_end_dist <= snap_tolerance else end

    return snapped_start, snapped_end


async def _verify_top_segments(
    candidates: list[ScoredSegment],
    video_path: str,
    work_dir: str,
    target_duration: int,
    game_title: str | None,
    genre: str | None,
    loop: asyncio.AbstractEventLoop,
) -> list[ScoredSegment]:
    """Verify the top-N candidates by sending video clips to Gemini.

    Only verify enough segments to fill ~2x the target duration,
    since verification is the most expensive per-call operation.
    """
    sorted_candidates = sorted(candidates, key=lambda s: s.gemini_score, reverse=True)

    cumulative_duration = 0.0
    to_verify: list[ScoredSegment] = []
    for seg in sorted_candidates:
        to_verify.append(seg)
        cumulative_duration += seg.duration
        if cumulative_duration >= target_duration * 2.5:
            break

    verified: list[ScoredSegment] = []
    for i, seg in enumerate(to_verify):
        try:
            score, label, pacing = await loop.run_in_executor(
                None,
                verify_segment,
                video_path,
                seg.start_time,
                seg.end_time,
                work_dir,
                i,
                game_title,
                genre,
            )
            verified.append(ScoredSegment(
                start_time=seg.start_time,
                end_time=seg.end_time,
                duration=seg.duration,
                gemini_score=score,
                video_intel_score=seg.video_intel_score,
                audio_score=seg.audio_score,
                label=label,
                reason=seg.reason,
                pacing=pacing,
            ))
        except Exception:
            logger.warning("Verification failed for segment %d, using discovery score", i)
            verified.append(seg)

        if (i + 1) % 5 == 0:
            logger.info("Verified %d / %d segments", i + 1, len(to_verify))

    remaining = [s for s in sorted_candidates if s not in to_verify]
    verified.extend(remaining)

    return verified


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
    """Best-effort extraction of a session ID from the URI path."""
    parts = video_uri.replace("gs://", "").replace("s3://", "").split("/")
    if len(parts) >= 3:
        return parts[-2]
    return "unknown"
