"""Score video segments using Gemini multimodal analysis."""

from __future__ import annotations

import logging
import os
import subprocess
from dataclasses import dataclass

from pipeline.scene_analysis import SceneAnalysisResult, ShotBoundary
from pipeline.audio_analysis import AudioAnalysisResult
from services.gemini_client import score_segment

logger = logging.getLogger(__name__)

FRAMES_PER_SEGMENT = 3
MIN_SEGMENT_DURATION = 2.0
WINDOW_DURATION = 15.0
MIN_SHOTS_FOR_WINDOW_FALLBACK = 5


@dataclass
class ScoredSegment:
    start_time: float
    end_time: float
    duration: float
    gemini_score: float
    video_intel_score: float
    audio_score: float
    label: str
    reason: str = ""
    pacing: str = "intense"


def _extract_frames(
    video_path: str,
    start_time: float,
    end_time: float,
    work_dir: str,
    segment_index: int,
    num_frames: int = FRAMES_PER_SEGMENT,
) -> list[str]:
    """Extract evenly-spaced frames from a video segment."""
    duration = end_time - start_time
    if duration <= 0:
        return []

    frame_paths: list[str] = []
    for i in range(num_frames):
        t = start_time + (duration * (i + 0.5) / num_frames)
        out_path = os.path.join(work_dir, f"frame_{segment_index}_{i}.jpg")
        cmd = [
            "ffmpeg", "-y",
            "-ss", f"{t:.3f}",
            "-i", video_path,
            "-frames:v", "1",
            "-q:v", "2",
            out_path,
        ]
        try:
            subprocess.run(cmd, check=True, capture_output=True)
            frame_paths.append(out_path)
        except subprocess.CalledProcessError:
            logger.warning("Failed to extract frame at t=%.1f for segment %d", t, segment_index)

    return frame_paths


def _compute_video_intel_score(
    shot: ShotBoundary,
    scene: SceneAnalysisResult,
) -> float:
    """Compute a 0-100 score from Video Intelligence signals for a shot."""
    score = 0.0
    total_weight = 0.0

    overlapping_labels = [
        l for l in scene.labels
        if l.start_time < shot.end_time and l.end_time > shot.start_time
    ]
    if overlapping_labels:
        avg_confidence = sum(l.confidence for l in overlapping_labels) / len(overlapping_labels)
        label_diversity = min(len(set(l.name for l in overlapping_labels)) / 5.0, 1.0)
        score += (avg_confidence * 0.5 + label_diversity * 0.5) * 100
        total_weight += 1.0

    overlapping_texts = [
        t for t in scene.texts
        if shot.start_time <= t.timestamp <= shot.end_time
    ]
    if overlapping_texts:
        text_score = min(len(overlapping_texts) / 3.0, 1.0) * 100
        score += text_score
        total_weight += 1.5

    overlapping_objects = [
        o for o in scene.objects
        if o.start_time < shot.end_time and o.end_time > shot.start_time
    ]
    if overlapping_objects:
        obj_score = min(len(overlapping_objects) / 5.0, 1.0) * 100
        score += obj_score
        total_weight += 0.8

    if total_weight == 0:
        return 30.0

    return min(score / total_weight, 100.0)


def _get_audio_score_for_segment(
    start_time: float,
    end_time: float,
    audio: AudioAnalysisResult,
) -> float:
    """Get normalized audio energy score for a time range (0-100)."""
    segment_energies = [
        e for ts, e in audio.rms_timeline
        if start_time <= ts <= end_time
    ]
    if not segment_energies or audio.max_energy == 0:
        return 30.0

    segment_mean = sum(segment_energies) / len(segment_energies)
    relative_energy = segment_mean / audio.max_energy

    peak_in_segment = any(
        p for p in audio.peaks
        if start_time <= p.timestamp <= end_time
    )
    peak_bonus = 20.0 if peak_in_segment else 0.0

    return min(relative_energy * 80.0 + peak_bonus, 100.0)


def _create_windows(video_duration: float, window_size: float = WINDOW_DURATION) -> list[ShotBoundary]:
    """Create fixed-duration windows across the video."""
    windows: list[ShotBoundary] = []
    t = 0.0
    while t < video_duration:
        end = min(t + window_size, video_duration)
        if end - t >= MIN_SEGMENT_DURATION:
            windows.append(ShotBoundary(start_time=t, end_time=end, duration=end - t))
        t = end
    return windows


def score_segments(
    video_path: str,
    scene: SceneAnalysisResult,
    audio: AudioAnalysisResult,
    work_dir: str,
    game_title: str | None = None,
) -> list[ScoredSegment]:
    """Score all shot segments using Video Intelligence data, audio data, and Gemini."""
    shots = scene.shots

    if len(shots) < MIN_SHOTS_FOR_WINDOW_FALLBACK:
        logger.info(
            "Only %d shots detected — using fixed %.0fs windows instead",
            len(shots), WINDOW_DURATION,
        )
        shots = _create_windows(scene.video_duration)

    segments: list[ScoredSegment] = []

    for i, shot in enumerate(shots):
        if shot.duration < MIN_SEGMENT_DURATION:
            continue

        video_intel_score = _compute_video_intel_score(shot, scene)
        audio_score = _get_audio_score_for_segment(shot.start_time, shot.end_time, audio)

        labels_in_shot = list(set(
            l.name for l in scene.labels
            if l.start_time < shot.end_time and l.end_time > shot.start_time
        ))

        frames = _extract_frames(video_path, shot.start_time, shot.end_time, work_dir, i)

        if frames:
            gemini_score, label = score_segment(
                frame_paths=frames,
                labels=labels_in_shot,
                audio_peak_score=audio_score / 100.0,
                game_title=game_title,
            )
        else:
            gemini_score = 50.0
            label = "no frames"

        segments.append(ScoredSegment(
            start_time=shot.start_time,
            end_time=shot.end_time,
            duration=shot.duration,
            gemini_score=gemini_score,
            video_intel_score=video_intel_score,
            audio_score=audio_score,
            label=label,
        ))

        for f in frames:
            try:
                os.remove(f)
            except OSError:
                pass

        if (i + 1) % 10 == 0:
            logger.info("Scored %d / %d segments", i + 1, len(shots))

    logger.info("Segment scoring complete: %d segments scored", len(segments))
    return segments
