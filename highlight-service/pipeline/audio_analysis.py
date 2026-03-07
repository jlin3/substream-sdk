"""Detect audio energy peaks in a video file using pydub and numpy."""

from __future__ import annotations

import logging
import os
import subprocess
from dataclasses import dataclass

import numpy as np
from pydub import AudioSegment

logger = logging.getLogger(__name__)

WINDOW_MS = 1000
HOP_MS = 500


@dataclass
class AudioPeak:
    timestamp: float
    energy: float
    normalized_score: float


@dataclass
class AudioAnalysisResult:
    peaks: list[AudioPeak]
    rms_timeline: list[tuple[float, float]]
    mean_energy: float
    max_energy: float


def _extract_audio(video_path: str, work_dir: str) -> str:
    """Extract audio track from video to a WAV file using ffmpeg."""
    audio_path = os.path.join(work_dir, "audio.wav")
    cmd = [
        "ffmpeg", "-y",
        "-i", video_path,
        "-vn",
        "-acodec", "pcm_s16le",
        "-ar", "22050",
        "-ac", "1",
        audio_path,
    ]
    logger.info("Extracting audio from %s", video_path)
    subprocess.run(cmd, check=True, capture_output=True)
    return audio_path


def _compute_rms_timeline(audio: AudioSegment) -> list[tuple[float, float]]:
    """Compute RMS energy over sliding windows. Returns list of (timestamp_sec, rms)."""
    samples = np.array(audio.get_array_of_samples(), dtype=np.float64)
    sample_rate = audio.frame_rate
    window_samples = int(sample_rate * WINDOW_MS / 1000)
    hop_samples = int(sample_rate * HOP_MS / 1000)

    timeline: list[tuple[float, float]] = []
    for start in range(0, len(samples) - window_samples + 1, hop_samples):
        window = samples[start : start + window_samples]
        rms = float(np.sqrt(np.mean(window**2)))
        timestamp = start / sample_rate
        timeline.append((timestamp, rms))

    return timeline


def _find_peaks(
    rms_timeline: list[tuple[float, float]],
    threshold_factor: float = 1.5,
    min_gap_seconds: float = 3.0,
) -> list[AudioPeak]:
    """Find energy peaks that exceed threshold_factor * mean energy, with a
    minimum gap between peaks to avoid clustering."""
    if not rms_timeline:
        return []

    energies = [e for _, e in rms_timeline]
    mean_energy = float(np.mean(energies))
    max_energy = float(np.max(energies)) if energies else 1.0
    threshold = mean_energy * threshold_factor

    candidates = [
        (ts, e) for ts, e in rms_timeline if e >= threshold
    ]

    peaks: list[AudioPeak] = []
    for ts, energy in sorted(candidates, key=lambda x: -x[1]):
        if peaks and any(abs(ts - p.timestamp) < min_gap_seconds for p in peaks):
            continue
        normalized = energy / max_energy if max_energy > 0 else 0.0
        peaks.append(AudioPeak(timestamp=ts, energy=energy, normalized_score=normalized))

    peaks.sort(key=lambda p: p.timestamp)
    return peaks


def analyze_audio(video_path: str, work_dir: str) -> AudioAnalysisResult:
    """Run full audio analysis on a local video file."""
    audio_path = _extract_audio(video_path, work_dir)
    audio = AudioSegment.from_wav(audio_path)

    rms_timeline = _compute_rms_timeline(audio)
    peaks = _find_peaks(rms_timeline)

    energies = [e for _, e in rms_timeline]
    mean_energy = float(np.mean(energies)) if energies else 0.0
    max_energy = float(np.max(energies)) if energies else 0.0

    logger.info(
        "Audio analysis: %d peaks detected, mean=%.1f, max=%.1f",
        len(peaks), mean_energy, max_energy,
    )

    os.remove(audio_path)

    return AudioAnalysisResult(
        peaks=peaks,
        rms_timeline=rms_timeline,
        mean_energy=mean_energy,
        max_energy=max_energy,
    )
