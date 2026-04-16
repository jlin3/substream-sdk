"""Vertex AI Gemini client for whole-video highlight discovery and segment verification.

Phase 1a: Send full gameplay video to Gemini 3.1 Pro for native video understanding.
Phase 1c: Verify individual segments by sending short video clips.
Uses structured output (response_schema) for guaranteed JSON responses.
"""

from __future__ import annotations

import json
import logging
import os
import subprocess
from dataclasses import dataclass, field

import config

logger = logging.getLogger(__name__)

_discovery_model: GenerativeModel | None = None
_verify_model: GenerativeModel | None = None
_initialized = False

HIGHLIGHT_DISCOVERY_SCHEMA = {
    "type": "object",
    "properties": {
        "highlights": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "start_seconds": {"type": "number"},
                    "end_seconds": {"type": "number"},
                    "score": {"type": "integer", "minimum": 0, "maximum": 100},
                    "label": {"type": "string"},
                    "reason": {"type": "string"},
                },
                "required": ["start_seconds", "end_seconds", "score", "label", "reason"],
            },
        },
        "game_detected": {"type": "string"},
        "genre_detected": {
            "type": "string",
            "enum": [
                "fps", "moba", "battle_royale", "sports", "racing",
                "rpg", "strategy", "platformer", "fighting", "simulation", "other",
            ],
        },
        "overall_energy": {
            "type": "string",
            "enum": ["low", "medium", "high"],
        },
    },
    "required": ["highlights", "game_detected", "genre_detected", "overall_energy"],
}

SEGMENT_VERIFY_SCHEMA = {
    "type": "object",
    "properties": {
        "score": {"type": "integer", "minimum": 0, "maximum": 100},
        "label": {"type": "string"},
        "reason": {"type": "string"},
        "pacing": {
            "type": "string",
            "enum": ["slow", "building", "intense", "climactic", "calm"],
        },
    },
    "required": ["score", "label", "reason", "pacing"],
}


@dataclass
class DiscoveredHighlight:
    start_seconds: float
    end_seconds: float
    score: float
    label: str
    reason: str


@dataclass
class VideoDiscoveryResult:
    highlights: list[DiscoveredHighlight] = field(default_factory=list)
    game_detected: str = "unknown"
    genre_detected: str = "other"
    overall_energy: str = "medium"


def _ensure_init():
    global _initialized
    if not _initialized:
        import vertexai
        location = "global" if "preview" in config.GEMINI_DISCOVERY_MODEL else config.GCP_REGION
        vertexai.init(project=config.GCP_PROJECT, location=location)
        _initialized = True


def _get_discovery_model():
    global _discovery_model
    _ensure_init()
    if _discovery_model is None:
        from vertexai.generative_models import GenerativeModel
        system_prompt = load_prompt("system_base")
        _discovery_model = GenerativeModel(
            config.GEMINI_DISCOVERY_MODEL,
            system_instruction=system_prompt if system_prompt else None,
        )
    return _discovery_model


def _get_verify_model():
    global _verify_model
    _ensure_init()
    if _verify_model is None:
        from vertexai.generative_models import GenerativeModel
        model_name = config.GEMINI_TUNED_MODEL or config.GEMINI_SCORING_MODEL
        _verify_model = GenerativeModel(model_name)
    return _verify_model


def load_prompt(prompt_name: str) -> str:
    """Load a prompt template from the prompts/ directory."""
    prompts_dir = os.path.join(os.path.dirname(os.path.dirname(__file__)), "prompts")
    path = os.path.join(prompts_dir, f"{prompt_name}.txt")
    if os.path.exists(path):
        with open(path) as f:
            return f.read().strip()
    return ""


def get_genre_prompt(genre: str) -> str:
    """Load genre-specific prompt, falling back to generic."""
    prompt = load_prompt(f"game_{genre}")
    return prompt or load_prompt("game_generic")


def _guess_mime_type(uri_or_path: str) -> str:
    if uri_or_path.endswith(".webm"):
        return "video/webm"
    if uri_or_path.endswith(".mov"):
        return "video/quicktime"
    return "video/mp4"


def discover_highlights(
    gcs_uri: str,
    target_duration: int,
    game_title: str | None = None,
) -> VideoDiscoveryResult:
    """Send the full video to Gemini 3.1 Pro and get timestamped highlight candidates.

    This is the core of Phase 1a — native whole-video understanding replaces
    the old per-segment frame-sampling approach.
    """
    from vertexai.generative_models import GenerationConfig, Part

    model = _get_discovery_model()
    video_part = Part.from_uri(uri=gcs_uri, mime_type=_guess_mime_type(gcs_uri))

    game_context = f" The game being played is '{game_title}'." if game_title else ""
    prompt = (
        f"Watch this entire gameplay recording and identify the most highlight-worthy moments.{game_context}\n\n"
        f"I need approximately {target_duration} seconds of highlights. "
        f"Identify 15-30 candidate moments, scored by highlight quality.\n\n"
        f"For each highlight, provide:\n"
        f"- Precise start and end timestamps (in seconds from the beginning of the video)\n"
        f"- A score from 0-100 for highlight-worthiness\n"
        f"- A short label (e.g. 'clutch 1v3', 'epic headshot', 'team wipe')\n"
        f"- A brief reason why this moment is a highlight\n\n"
        f"Consider: action intensity, dramatic moments, visual excitement, "
        f"social shareability, key game events (victories, defeats, clutch moments, kills), "
        f"audio cues (explosions, cheering, music swells).\n\n"
        f"Prefer moments with clear visual and audio impact. Avoid menus, loading screens, "
        f"and idle gameplay unless something surprising happens.\n\n"
        f"Ensure highlights don't overlap. Each moment should be 3-30 seconds long."
    )

    logger.info("Sending full video to Gemini for highlight discovery: %s", gcs_uri)

    try:
        response = model.generate_content(
            [video_part, prompt],
            generation_config=GenerationConfig(
                response_mime_type="application/json",
                response_schema=HIGHLIGHT_DISCOVERY_SCHEMA,
            ),
        )
    except (ValueError, TypeError) as exc:
        # Config/auth errors should fail fast — don't mask them
        raise RuntimeError(f"Gemini discovery failed (likely config/auth issue): {exc}") from exc
    except Exception:
        logger.exception("Gemini discovery call failed (retryable)")
        return VideoDiscoveryResult()

    if not response.candidates:
        logger.warning("Gemini discovery returned no candidates (may have been blocked)")
        return VideoDiscoveryResult()

    data = json.loads(response.text)

    highlights = []
    for h in data.get("highlights", []):
        start = float(h["start_seconds"])
        end = float(h["end_seconds"])
        if end <= start:
            continue
        highlights.append(DiscoveredHighlight(
            start_seconds=start,
            end_seconds=end,
            score=float(h["score"]),
            label=h["label"],
            reason=h["reason"],
        ))

    highlights.sort(key=lambda h: h.start_seconds)

    result = VideoDiscoveryResult(
        highlights=highlights,
        game_detected=data.get("game_detected", "unknown"),
        genre_detected=data.get("genre_detected", "other"),
        overall_energy=data.get("overall_energy", "medium"),
    )

    logger.info(
        "Gemini discovery found %d highlights (game=%s, genre=%s, energy=%s)",
        len(highlights), result.game_detected, result.genre_detected, result.overall_energy,
    )
    return result


def verify_segment(
    video_path: str,
    start_seconds: float,
    end_seconds: float,
    work_dir: str,
    segment_index: int,
    game_title: str | None = None,
    genre: str | None = None,
) -> tuple[float, str, str]:
    """Cut a segment from the local video and send the clip to Gemini for refined scoring.

    Returns (score, label, pacing).
    """
    clip_path = os.path.join(work_dir, f"verify_{segment_index:03d}.mp4")
    duration = end_seconds - start_seconds

    cmd = [
        "ffmpeg", "-y",
        "-ss", f"{start_seconds:.3f}",
        "-i", video_path,
        "-t", f"{duration:.3f}",
        "-c:v", "libx264", "-crf", "28", "-preset", "ultrafast",
        "-c:a", "aac", "-b:a", "128k",
        "-movflags", "+faststart",
        clip_path,
    ]

    try:
        subprocess.run(cmd, check=True, capture_output=True)
    except subprocess.CalledProcessError:
        logger.warning("Failed to cut verification clip at %.1f-%.1f", start_seconds, end_seconds)
        return 50.0, "cut_failed", "intense"

    from vertexai.generative_models import GenerationConfig, Part

    model = _get_verify_model()
    genre_instructions = get_genre_prompt(genre or "generic")
    game_context = f" from the game '{game_title}'" if game_title else ""

    prompt = (
        f"You are analyzing a gameplay video clip{game_context}.\n\n"
        f"{genre_instructions}\n\n"
        f"Rate this clip from 0 to 100 for highlight-worthiness and describe its pacing.\n"
        f"Consider action intensity, dramatic moments, visual excitement, "
        f"social shareability, and key game events."
    )

    try:
        with open(clip_path, "rb") as f:
            clip_bytes = f.read()

        video_part = Part.from_data(data=clip_bytes, mime_type="video/mp4")

        response = model.generate_content(
            [video_part, prompt],
            generation_config=GenerationConfig(
                response_mime_type="application/json",
                response_schema=SEGMENT_VERIFY_SCHEMA,
            ),
        )

        if not response.candidates:
            return 50.0, "blocked", "intense"

        data = json.loads(response.text)
        return float(data["score"]), data["label"], data.get("pacing", "intense")

    except Exception:
        logger.exception("Segment verification failed for segment %d", segment_index)
        return 50.0, "verify_error", "intense"
    finally:
        try:
            os.remove(clip_path)
        except OSError:
            pass
