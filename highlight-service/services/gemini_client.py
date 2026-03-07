"""Vertex AI Gemini client for multimodal video segment scoring."""

from __future__ import annotations

import logging

import vertexai
from vertexai.generative_models import GenerativeModel, Image, Part

import config

logger = logging.getLogger(__name__)

_model: GenerativeModel | None = None
_initialized = False


def _ensure_init():
    global _initialized
    if not _initialized:
        location = "global" if "preview" in config.GEMINI_MODEL else config.GCP_REGION
        vertexai.init(project=config.GCP_PROJECT, location=location)
        _initialized = True


def _get_model() -> GenerativeModel:
    global _model
    _ensure_init()
    if _model is None:
        _model = GenerativeModel(config.GEMINI_MODEL)
    return _model


def score_segment(
    frame_paths: list[str],
    labels: list[str],
    audio_peak_score: float,
    game_title: str | None = None,
) -> tuple[float, str]:
    """Score a gameplay segment for highlight-worthiness using Gemini.

    Args:
        frame_paths: Paths to representative frames (JPEG images) from the segment.
        labels: Video Intelligence labels detected in this segment.
        audio_peak_score: Normalized audio energy score (0-1) for this segment.
        game_title: Optional game name for context.

    Returns:
        (score, label) where score is 0-100 and label is a short description.
    """
    model = _get_model()

    parts: list[Part] = []

    game_context = f" from the game '{game_title}'" if game_title else ""
    label_context = ", ".join(labels) if labels else "none detected"

    prompt = (
        f"You are analyzing a gameplay video segment{game_context}. "
        f"The following frames are sampled from this segment. "
        f"Detected visual labels: {label_context}. "
        f"Audio energy score: {audio_peak_score:.2f} (0=silent, 1=peak intensity). "
        f"\n\n"
        f"Rate this segment from 0 to 100 for highlight-worthiness. Consider:\n"
        f"- Action intensity and dramatic moments\n"
        f"- Visual excitement (explosions, fast movement, impressive plays)\n"
        f"- Social shareability (would someone want to clip this?)\n"
        f"- Key game events (victories, defeats, clutch moments, kills)\n"
        f"\n"
        f"Respond with ONLY a JSON object: {{\"score\": <0-100>, \"label\": \"<short description>\"}}"
    )

    parts.append(Part.from_text(prompt))

    for path in frame_paths:
        parts.append(Part.from_image(Image.load_from_file(path)))

    response = model.generate_content(parts)

    if not response.candidates:
        logger.warning("Gemini returned no candidates (response may have been blocked)")
        return 50.0, "blocked"

    return _parse_response(response.text)


def _parse_response(text: str) -> tuple[float, str]:
    """Parse Gemini's JSON response into (score, label)."""
    import json

    cleaned = text.strip()
    if cleaned.startswith("```"):
        lines = cleaned.split("\n")
        cleaned = "\n".join(lines[1:-1])

    try:
        data = json.loads(cleaned)
        score = float(data.get("score", 50))
        label = str(data.get("label", "gameplay"))
        return min(max(score, 0), 100), label
    except (json.JSONDecodeError, ValueError, KeyError):
        logger.warning("Failed to parse Gemini response: %s", text[:200])
        return 50.0, "unscored"
