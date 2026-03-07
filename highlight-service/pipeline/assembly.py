"""Assemble selected highlight segments into a final video reel using FFmpeg."""

from __future__ import annotations

import logging
import os
import shutil
import subprocess

from pipeline.highlight_selection import SelectedSegment

logger = logging.getLogger(__name__)

CROSSFADE_DURATION = 0.5
VIDEO_CODEC = "libx264"
AUDIO_CODEC = "aac"
CRF = "23"
PRESET = "medium"
AUDIO_BITRATE = "192k"


def _cut_segment(
    video_path: str,
    segment: SelectedSegment,
    index: int,
    work_dir: str,
) -> str:
    """Cut a single segment from the source video."""
    out_path = os.path.join(work_dir, f"seg_{index:03d}.mp4")
    cmd = [
        "ffmpeg", "-y",
        "-ss", f"{segment.start_time:.3f}",
        "-i", video_path,
        "-t", f"{segment.duration:.3f}",
        "-c:v", VIDEO_CODEC,
        "-crf", CRF,
        "-preset", "ultrafast",
        "-c:a", AUDIO_CODEC,
        "-b:a", AUDIO_BITRATE,
        "-movflags", "+faststart",
        out_path,
    ]
    subprocess.run(cmd, check=True, capture_output=True)
    return out_path


def assemble_highlight_reel(
    video_path: str,
    segments: list[SelectedSegment],
    output_path: str,
    work_dir: str,
) -> str:
    """Cut selected segments and concatenate them with crossfades and
    normalized audio into a final highlight reel.

    Returns the path to the output file.
    """
    if not segments:
        raise ValueError("No segments to assemble")

    logger.info("Assembling %d segments into highlight reel", len(segments))

    clip_paths: list[str] = []
    for i, seg in enumerate(segments):
        clip_path = _cut_segment(video_path, seg, i, work_dir)
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
    """Concatenate clips with crossfade transitions using filter_complex."""
    n = len(clip_paths)
    if n < 2:
        raise ValueError("Need at least 2 clips for crossfade concat")

    inputs: list[str] = []
    for p in clip_paths:
        inputs.extend(["-i", p])

    filter_parts: list[str] = []
    xfade_duration = CROSSFADE_DURATION

    current_video = "[0:v]"
    current_audio = "[0:a]"
    cumulative_offset = segments[0].duration - xfade_duration

    for i in range(1, n):
        out_v = f"[v{i}]" if i < n - 1 else "[vout]"
        out_a = f"[a{i}]" if i < n - 1 else "[aout]"

        filter_parts.append(
            f"{current_video}[{i}:v]xfade=transition=fade:duration={xfade_duration}:offset={cumulative_offset:.3f}{out_v}"
        )
        filter_parts.append(
            f"{current_audio}[{i}:a]acrossfade=d={xfade_duration}{out_a}"
        )

        current_video = out_v
        current_audio = out_a
        cumulative_offset += segments[i].duration - xfade_duration

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

    logger.info("Running crossfade concatenation")
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
