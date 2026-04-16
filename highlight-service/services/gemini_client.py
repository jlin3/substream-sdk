"""Vertex AI Gemini client for per-segment scoring with structured output.

This is the legacy per-frame scoring client, upgraded to use structured output
(response_schema) instead of fragile JSON parsing. Used as fallback when
whole-video discovery is not available.
"""

from __future__ import annotations

import json
import logging

import vertexai
from vertexai.generative_models import GenerativeModel, GenerationConfig, Image, Part

import config

logger = logging.getLogger(__name__)

_model: GenerativeModel | None = None
_initialized = False

SCORE_RESPONSE_SCHEMA = {
    "type": "object",
    "properties": {
        "score": {"type": "integer", "minimum": 0, "maximum": 100},
        "label": {"type": "string"},
    },
    "required": ["score", "label"],
}


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

    Uses structured output for guaranteed valid JSON responses.

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
    )

    parts.append(Part.from_text(prompt))

    for path in frame_paths:
        parts.append(Part.from_image(Image.load_from_file(path)))

    try:
        response = model.generate_content(
            parts,
            generation_config=GenerationConfig(
                response_mime_type="application/json",
                response_schema=SCORE_RESPONSE_SCHEMA,
            ),
        )
    except Exception:
        logger.exception("Gemini scoring call failed")
        return 50.0, "error"

    if not response.candidates:
        logger.warning("Gemini returned no candidates (response may have been blocked)")
        return 50.0, "blocked"

    data = json.loads(response.text)
    score = float(data.get("score", 50))
    label = str(data.get("label", "gameplay"))
    return min(max(score, 0), 100), label
