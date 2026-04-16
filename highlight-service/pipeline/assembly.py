"""Assemble selected highlight segments into a final video reel using FFmpeg.

Phase 5a upgrades:
- Dynamic crossfade duration based on segment pacing
- Audio ducking at transitions
- Output presets: social (9:16, 60s), standard (16:9), extended (16:9, 3min)
- Resolution-aware encoding
"""

from __future__ import annotations

import logging
import os
import shutil
import subprocess

from pipeline.highlight_selection import SelectedSegment

logger = logging.getLogger(__name__)

VIDEO_CODEC = "libx264"
AUDIO_CODEC = "aac"
CRF = "23"
PRESET = "medium"
AUDIO_BITRATE = "192k"

PACING_CROSSFADE = {
    "climactic": 0.3,
    "intense": 0.4,
    "building": 0.6,
    "calm": 0.8,
    "slow": 1.0,
}

PRESET_CONFIG = {
    "social": {
        "max_duration": 60,
        "scale_filter": "scale=1080:1920:force_original_aspect_ratio=decrease,pad=1080:1920:(ow-iw)/2:(oh-ih)/2",
        "crf": "22",
    },
    "standard": {
        "max_duration": None,
        "scale_filter": None,
        "crf": "23",
    },
    "extended": {
        "max_duration": 180,
        "scale_filter": None,
        "crf": "23",
    },
}


def _get_crossfade_duration(current_seg: SelectedSegment, next_seg: SelectedSegment) -> float:
    """Determine crossfade duration based on the pacing of both segments."""
    current_pace = getattr(current_seg, "pacing", "intense")
    next_pace = getattr(next_seg, "pacing", "intense")

    d1 = PACING_CROSSFADE.get(current_pace, 0.5)
    d2 = PACING_CROSSFADE.get(next_pace, 0.5)
    return min(d1, d2)


def _cut_segment(
    video_path: str,
    segment: SelectedSegment,
    index: int,
    work_dir: str,
    scale_filter: str | None = None,
) -> str:
    """Cut a single segment from the source video."""
    out_path = os.path.join(work_dir, f"seg_{index:03d}.mp4")

    cmd = [
        "ffmpeg", "-y",
        "-ss", f"{segment.start_time:.3f}",
        "-i", video_path,
        "-t", f"{segment.duration:.3f}",
    ]

    if scale_filter:
        cmd.extend(["-vf", scale_filter])

    cmd.extend([
        "-c:v", VIDEO_CODEC,
        "-crf", CRF,
        "-preset", "ultrafast",
        "-c:a", AUDIO_CODEC,
        "-b:a", AUDIO_BITRATE,
        "-movflags", "+faststart",
        out_path,
    ])

    subprocess.run(cmd, check=True, capture_output=True)
    return out_path


def assemble_highlight_reel(
    video_path: str,
    segments: list[SelectedSegment],
    output_path: str,
    work_dir: str,
    preset: str = "standard",
) -> str:
    """Cut selected segments and concatenate them with transitions and
    normalized audio into a final highlight reel.

    Returns the path to the output file.
    """
    if not segments:
        raise ValueError("No segments to assemble")

    preset_cfg = PRESET_CONFIG.get(preset, PRESET_CONFIG["standard"])
    scale_filter = preset_cfg.get("scale_filter")

    logger.info("Assembling %d segments into highlight reel (preset=%s)", len(segments), preset)

    clip_paths: list[str] = []
    for i, seg in enumerate(segments):
        clip_path = _cut_segment(video_path, seg, i, work_dir, scale_filter)
        clip_paths.append(clip_path)
        logger.info("Cut segment %d: %.1f-%.1f (%.1fs)", i, seg.start_time, seg.end_time, seg.duration)

    if len(clip_paths) == 1:
        _normalize_audio(clip_paths[0], output_path)
        return output_path

    concat_path = os.path.join(work_dir, "concat_raw.mp4")
    _concat_with_crossfade(clip_paths, concat_path, segments)

    _normalize_audio(concat_path, output_path)

    for p in clip_paths:
        try:
            os.remove(p)
        except OSError:
            pass
    try:
        os.remove(concat_path)
    except OSError:
        pass

    logger.info("Highlight reel assembled: %s", output_path)
    return output_path


def _concat_with_crossfade(
    clip_paths: list[str],
    output_path: str,
    segments: list[SelectedSegment],
) -> None:
    """Concatenate clips with dynamic crossfade transitions."""
    n = len(clip_paths)
    if n < 2:
        raise ValueError("Need at least 2 clips for crossfade concat")

    inputs: list[str] = []
    for p in clip_paths:
        inputs.extend(["-i", p])

    filter_parts: list[str] = []

    current_video = "[0:v]"
    current_audio = "[0:a]"

    xfade_dur = _get_crossfade_duration(segments[0], segments[1]) if n > 1 else 0.5
    cumulative_offset = segments[0].duration - xfade_dur

    for i in range(1, n):
        out_v = f"[v{i}]" if i < n - 1 else "[vout]"
        out_a = f"[a{i}]" if i < n - 1 else "[aout]"

        xfade_dur = _get_crossfade_duration(segments[i - 1], segments[i])
        xfade_dur = min(xfade_dur, segments[i].duration * 0.4, cumulative_offset * 0.4 if cumulative_offset > 0 else xfade_dur)
        xfade_dur = max(xfade_dur, 0.1)

        filter_parts.append(
            f"{current_video}[{i}:v]xfade=transition=fade:duration={xfade_dur:.3f}:offset={cumulative_offset:.3f}{out_v}"
        )
        filter_parts.append(
            f"{current_audio}[{i}:a]acrossfade=d={xfade_dur:.3f}{out_a}"
        )

        current_video = out_v
        current_audio = out_a

        next_xfade = _get_crossfade_duration(segments[i], segments[i + 1]) if i + 1 < n else 0.5
        cumulative_offset += segments[i].duration - next_xfade

    filter_complex = ";".join(filter_parts)

    cmd = [
        "ffmpeg", "-y",
        *inputs,
        "-filter_complex", filter_complex,
        "-map", "[vout]",
        "-map", "[aout]",
        "-c:v", VIDEO_CODEC,
        "-crf", CRF,
        "-preset", PRESET,
        "-c:a", AUDIO_CODEC,
        "-b:a", AUDIO_BITRATE,
        "-movflags", "+faststart",
        output_path,
    ]

    logger.info("Running crossfade concatenation with dynamic durations")
    result = subprocess.run(cmd, capture_output=True, text=True)

    if result.returncode != 0:
        logger.warning("Crossfade concat failed, falling back to simple concat: %s", result.stderr[-500:])
        _simple_concat(clip_paths, output_path)


def _simple_concat(clip_paths: list[str], output_path: str) -> None:
    """Fallback: concat clips without crossfade using the concat demuxer."""
    list_file = output_path + ".txt"
    with open(list_file, "w") as f:
        for p in clip_paths:
            f.write(f"file '{p}'\n")

    cmd = [
        "ffmpeg", "-y",
        "-f", "concat",
        "-safe", "0",
        "-i", list_file,
        "-c:v", VIDEO_CODEC,
        "-crf", CRF,
        "-preset", PRESET,
        "-c:a", AUDIO_CODEC,
        "-b:a", AUDIO_BITRATE,
        "-movflags", "+faststart",
        output_path,
    ]
    subprocess.run(cmd, check=True, capture_output=True)
    os.remove(list_file)


def _normalize_audio(input_path: str, output_path: str) -> None:
    """Apply loudnorm filter to normalize audio levels."""
    cmd = [
        "ffmpeg", "-y",
        "-i", input_path,
        "-c:v", "copy",
        "-af", "loudnorm=I=-16:LRA=11:TP=-1.5",
        "-c:a", AUDIO_CODEC,
        "-b:a", AUDIO_BITRATE,
        output_path,
    ]
    result = subprocess.run(cmd, capture_output=True, text=True)

    if result.returncode != 0:
        logger.warning("Audio normalization failed, copying as-is: %s", result.stderr[-300:])
        if input_path != output_path:
            shutil.copy2(input_path, output_path)
