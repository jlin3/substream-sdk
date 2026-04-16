"""Quality self-review: send the assembled highlight reel back to Gemini for scoring.

Phase 4a: After assembly, have the model evaluate the final product for
pacing, transitions, dead air, and overall quality. If below threshold,
the orchestrator can retry with adjusted selection parameters.
"""

from __future__ import annotations

import json
import logging
import os

import config

logger = logging.getLogger(__name__)

_review_model: GenerativeModel | None = None
_initialized = False

REVIEW_SCHEMA = {
    "type": "object",
    "properties": {
        "overall_score": {"type": "integer", "minimum": 0, "maximum": 100},
        "pacing_score": {"type": "integer", "minimum": 0, "maximum": 100},
        "variety_score": {"type": "integer", "minimum": 0, "maximum": 100},
        "transition_score": {"type": "integer", "minimum": 0, "maximum": 100},
        "notes": {"type": "string"},
        "suggestions": {
            "type": "array",
            "items": {"type": "string"},
        },
    },
    "required": ["overall_score", "pacing_score", "variety_score", "transition_score", "notes"],
}


def _ensure_init():
    global _initialized
    if not _initialized:
        import vertexai
        location = "global" if "preview" in config.GEMINI_REVIEW_MODEL else config.GCP_REGION
        vertexai.init(project=config.GCP_PROJECT, location=location)
        _initialized = True


def _get_model():
    global _review_model
    _ensure_init()
    if _review_model is None:
        from vertexai.generative_models import GenerativeModel
        _review_model = GenerativeModel(config.GEMINI_REVIEW_MODEL)
    return _review_model


def review_highlight_reel(output_path: str) -> tuple[int, str]:
    """Review an assembled highlight reel and return (score, notes).

    Sends the video file to Gemini and asks it to rate the reel on multiple
    dimensions: pacing, variety, transitions, and overall quality.
    """
    if not os.path.exists(output_path):
        raise FileNotFoundError(f"Highlight reel not found: {output_path}")

    file_size = os.path.getsize(output_path)
    if file_size > 100 * 1024 * 1024:
        logger.warning("Highlight reel too large for review (%d bytes), skipping", file_size)
        return 70, "skipped: file too large for inline review"

    from vertexai.generative_models import GenerationConfig, Part

    model = _get_model()

    with open(output_path, "rb") as f:
        video_bytes = f.read()

    video_part = Part.from_data(data=video_bytes, mime_type="video/mp4")

    prompt = (
        "You are reviewing a gameplay highlight reel that was automatically generated. "
        "Rate it on the following dimensions (0-100 each):\n\n"
        "1. **Overall quality** — Is this a good highlight reel? Would you share it?\n"
        "2. **Pacing** — Does it flow well? Is there dead air or awkward timing?\n"
        "3. **Variety** — Does it show different types of moments, or is it repetitive?\n"
        "4. **Transitions** — Are the cuts between clips smooth and well-timed?\n\n"
        "Also provide brief notes on what could be improved, and specific suggestions "
        "like 'remove the third clip (too slow)' or 'the opening clip is weak'."
    )

    try:
        response = model.generate_content(
            [video_part, prompt],
            generation_config=GenerationConfig(
                response_mime_type="application/json",
                response_schema=REVIEW_SCHEMA,
            ),
        )

        if not response.candidates:
            logger.warning("Quality review returned no candidates")
            return 70, "review blocked by model"

        data = json.loads(response.text)
        overall = int(data.get("overall_score", 70))
        notes = data.get("notes", "")
        suggestions = data.get("suggestions", [])
        if suggestions:
            notes += " Suggestions: " + "; ".join(suggestions)

        logger.info(
            "Quality review: overall=%d, pacing=%d, variety=%d, transitions=%d",
            overall,
            data.get("pacing_score", 0),
            data.get("variety_score", 0),
            data.get("transition_score", 0),
        )

        return overall, notes

    except Exception:
        logger.exception("Quality review failed")
        return 70, "review error"
