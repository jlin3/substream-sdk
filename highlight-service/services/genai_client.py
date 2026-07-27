"""Gemini access layer built on the `google-genai` SDK.

Replaces the older `vertexai.generative_models` path. The Gemini 3 controls this
service depends on — `media_resolution`, `video_metadata.fps`, `thinking_level` —
are only exposed through `google-genai`.

Three backends, resolved in order by `GEMINI_BACKEND=auto`:

  vertex   ADC plus `GCP_PROJECT`. Production.
  api      `GEMINI_API_KEY`. Convenient for local work.
  replay   Serves cached responses from `ANNOTATION_CACHE_DIR` and calls nothing.

The replay backend is not a test double bolted on afterwards. A live demo that
depends on a third-party API responding on time in front of an audience is a
demo that eventually fails in front of an audience, so every annotated run is
cached on the way through and can be replayed byte-identically with no
credentials at all.

Every call is metered. `UsageMeter` converts token counts into dollars at the
published per-model rates, which is what lets the demo console show cost
accumulating in real time and what makes the pricing model defensible.
"""

from __future__ import annotations

import hashlib
import json
import logging
import os
import threading
import time
from dataclasses import dataclass, field
from typing import Any, Optional

import config

logger = logging.getLogger(__name__)


# --------------------------------------------------------------------------
# Pricing
# --------------------------------------------------------------------------


@dataclass(frozen=True)
class ModelRates:
    """Published USD rates per 1M tokens.

    `long_context_threshold` reflects Gemini 3 Pro's tier step: prompts above it
    bill every token, input and output, at the higher rate.
    """

    input_per_m: float
    output_per_m: float
    cached_input_per_m: float
    long_input_per_m: Optional[float] = None
    long_output_per_m: Optional[float] = None
    long_context_threshold: int = 200_000


# Verified against Google's published pricing pages, July 2026.
MODEL_RATES: dict[str, ModelRates] = {
    "gemini-3.1-pro-preview": ModelRates(
        input_per_m=2.00,
        output_per_m=12.00,
        cached_input_per_m=0.20,
        long_input_per_m=4.00,
        long_output_per_m=18.00,
    ),
    "gemini-3.6-flash": ModelRates(
        input_per_m=1.50, output_per_m=7.50, cached_input_per_m=0.15
    ),
    "gemini-3.5-flash": ModelRates(
        input_per_m=1.50, output_per_m=9.00, cached_input_per_m=0.15
    ),
    "gemini-3.5-flash-lite": ModelRates(
        input_per_m=0.30, output_per_m=2.50, cached_input_per_m=0.03
    ),
    "gemini-3.1-flash-lite": ModelRates(
        input_per_m=0.30, output_per_m=2.50, cached_input_per_m=0.03
    ),
}

_FALLBACK_RATES = ModelRates(input_per_m=1.50, output_per_m=7.50, cached_input_per_m=0.15)


def rates_for(model: str) -> ModelRates:
    """Resolve rates for a model id, tolerating version suffixes."""
    if model in MODEL_RATES:
        return MODEL_RATES[model]
    for known, rate in MODEL_RATES.items():
        if model.startswith(known):
            return rate
    logger.warning("No published rates for model %s; using Flash-class estimate", model)
    return _FALLBACK_RATES


def estimate_cost(
    model: str, input_tokens: int, output_tokens: int, cached_tokens: int = 0
) -> float:
    r = rates_for(model)
    long_context = (
        r.long_input_per_m is not None and input_tokens > r.long_context_threshold
    )
    in_rate = r.long_input_per_m if long_context else r.input_per_m
    out_rate = r.long_output_per_m if long_context else r.output_per_m
    billable_input = max(0, input_tokens - cached_tokens)
    return (
        billable_input / 1_000_000 * in_rate
        + cached_tokens / 1_000_000 * r.cached_input_per_m
        + output_tokens / 1_000_000 * out_rate
    )


@dataclass
class CallRecord:
    model: str
    purpose: str
    input_tokens: int
    output_tokens: int
    cached_tokens: int
    cost_usd: float
    latency_ms: float
    cache_hit: bool = False


@dataclass
class UsageMeter:
    """Thread-safe running tally of tokens, dollars and latency."""

    calls: list[CallRecord] = field(default_factory=list)
    _lock: threading.Lock = field(default_factory=threading.Lock, repr=False)

    def record(self, rec: CallRecord) -> None:
        with self._lock:
            self.calls.append(rec)

    @property
    def total_cost_usd(self) -> float:
        with self._lock:
            return sum(c.cost_usd for c in self.calls)

    @property
    def total_input_tokens(self) -> int:
        with self._lock:
            return sum(c.input_tokens for c in self.calls)

    @property
    def total_output_tokens(self) -> int:
        with self._lock:
            return sum(c.output_tokens for c in self.calls)

    @property
    def call_count(self) -> int:
        with self._lock:
            return len(self.calls)

    def summary(self) -> dict[str, Any]:
        with self._lock:
            calls = list(self.calls)
        by_model: dict[str, dict[str, Any]] = {}
        by_purpose: dict[str, dict[str, Any]] = {}
        for c in calls:
            for bucket, key in ((by_model, c.model), (by_purpose, c.purpose)):
                entry = bucket.setdefault(
                    key, {"calls": 0, "input_tokens": 0, "output_tokens": 0, "cost_usd": 0.0}
                )
                entry["calls"] += 1
                entry["input_tokens"] += c.input_tokens
                entry["output_tokens"] += c.output_tokens
                entry["cost_usd"] = round(entry["cost_usd"] + c.cost_usd, 6)
        latencies = [c.latency_ms for c in calls if not c.cache_hit]
        return {
            "calls": len(calls),
            "cache_hits": sum(1 for c in calls if c.cache_hit),
            "input_tokens": sum(c.input_tokens for c in calls),
            "output_tokens": sum(c.output_tokens for c in calls),
            "cost_usd": round(sum(c.cost_usd for c in calls), 6),
            "p50_latency_ms": round(_percentile(latencies, 50), 1),
            "p95_latency_ms": round(_percentile(latencies, 95), 1),
            "by_model": by_model,
            "by_purpose": by_purpose,
        }


def _percentile(values: list[float], pct: float) -> float:
    if not values:
        return 0.0
    ordered = sorted(values)
    idx = min(len(ordered) - 1, int(round((pct / 100.0) * (len(ordered) - 1))))
    return ordered[idx]


# --------------------------------------------------------------------------
# Backend resolution
# --------------------------------------------------------------------------

_client: Any = None
_backend: Optional[str] = None
_client_lock = threading.Lock()


def resolve_backend() -> str:
    """Pick a backend, preferring real credentials when they exist."""
    configured = (config.GEMINI_BACKEND or "auto").lower()
    if configured != "auto":
        return configured
    if config.GEMINI_API_KEY:
        return "api"
    if config.GCP_PROJECT:
        return "vertex"
    logger.warning(
        "No GEMINI_API_KEY and no GCP_PROJECT set; falling back to replay backend. "
        "Annotation will be served from %s.",
        config.ANNOTATION_CACHE_DIR,
    )
    return "replay"


def get_backend() -> str:
    global _backend
    if _backend is None:
        _backend = resolve_backend()
    return _backend


def get_client() -> Any:
    """Build (once) and return the genai client. Returns None in replay mode."""
    global _client
    backend = get_backend()
    if backend == "replay":
        return None
    with _client_lock:
        if _client is None:
            from google import genai

            if backend == "api":
                _client = genai.Client(api_key=config.GEMINI_API_KEY)
                logger.info("Gemini backend: Developer API")
            else:
                _client = genai.Client(
                    vertexai=True,
                    project=config.GCP_PROJECT,
                    location=config.GEMINI_GLOBAL_LOCATION,
                )
                logger.info(
                    "Gemini backend: Vertex AI (project=%s, location=%s)",
                    config.GCP_PROJECT,
                    config.GEMINI_GLOBAL_LOCATION,
                )
        return _client


def reset_client() -> None:
    """Drop the cached client and backend. Used by tests."""
    global _client, _backend
    with _client_lock:
        _client = None
        _backend = None


# --------------------------------------------------------------------------
# Response cache (backs both replay mode and demo warm-up)
# --------------------------------------------------------------------------


def _cache_key(
    purpose: str,
    model: str,
    prompt: str,
    media_fingerprint: str,
    system_instruction: str = "",
    thinking_level: str = "",
    temperature: str = "",
) -> str:
    """Hash every input that can change the response.

    The system instruction in particular has to be in here. It carries the
    annotation rules and gets edited far more often than the per-window prompt,
    so leaving it out means a prompt change silently replays annotations
    produced by the previous version of the rules.
    """
    h = hashlib.sha256()
    for part in (
        purpose,
        model,
        prompt,
        media_fingerprint,
        system_instruction,
        thinking_level,
        temperature,
    ):
        h.update(part.encode("utf-8"))
        h.update(b"\x00")
    return h.hexdigest()[:32]


def _cache_path(key: str) -> str:
    return os.path.join(config.ANNOTATION_CACHE_DIR, f"{key}.json")


def cache_read(key: str) -> Optional[dict[str, Any]]:
    path = _cache_path(key)
    if not os.path.exists(path):
        return None
    try:
        with open(path) as f:
            return json.load(f)
    except (OSError, json.JSONDecodeError):
        logger.warning("Corrupt annotation cache entry at %s", path)
        return None


def cache_write(key: str, payload: dict[str, Any]) -> None:
    try:
        os.makedirs(config.ANNOTATION_CACHE_DIR, exist_ok=True)
        tmp = _cache_path(key) + ".tmp"
        with open(tmp, "w") as f:
            json.dump(payload, f)
        os.replace(tmp, _cache_path(key))
    except OSError as exc:
        logger.warning("Could not write annotation cache entry: %s", exc)


# --------------------------------------------------------------------------
# Structured generation
# --------------------------------------------------------------------------


@dataclass
class MediaRef:
    """A piece of media to send with a prompt.

    Exactly one of `uri` or `data` is used. `fps` and `media_resolution` map to
    the Gemini 3 video controls and are the main levers on annotation cost.
    """

    mime_type: str = "video/mp4"
    uri: Optional[str] = None
    data: Optional[bytes] = None
    fps: Optional[float] = None
    start_offset_seconds: Optional[float] = None
    end_offset_seconds: Optional[float] = None
    media_resolution: Optional[str] = None

    def fingerprint(self) -> str:
        """Stable identity for caching, without hashing whole video payloads."""
        bits = [
            self.mime_type,
            self.uri or "",
            f"{self.fps}",
            f"{self.start_offset_seconds}",
            f"{self.end_offset_seconds}",
            self.media_resolution or "",
        ]
        if self.data is not None:
            bits.append(hashlib.sha256(self.data).hexdigest()[:32])
        return "|".join(bits)


_MEDIA_RESOLUTION_MAP = {
    "low": "MEDIA_RESOLUTION_LOW",
    "medium": "MEDIA_RESOLUTION_MEDIUM",
    "high": "MEDIA_RESOLUTION_HIGH",
    "unspecified": "MEDIA_RESOLUTION_UNSPECIFIED",
}


def _build_media_part(media: MediaRef) -> Any:
    from google.genai import types

    video_metadata = None
    if media.mime_type.startswith("video/") and (
        media.fps is not None
        or media.start_offset_seconds is not None
        or media.end_offset_seconds is not None
    ):
        video_metadata = types.VideoMetadata(
            fps=media.fps,
            start_offset=(
                f"{media.start_offset_seconds}s"
                if media.start_offset_seconds is not None
                else None
            ),
            end_offset=(
                f"{media.end_offset_seconds}s"
                if media.end_offset_seconds is not None
                else None
            ),
        )

    if media.uri:
        part = types.Part(
            file_data=types.FileData(file_uri=media.uri, mime_type=media.mime_type)
        )
    elif media.data is not None:
        part = types.Part(
            inline_data=types.Blob(data=media.data, mime_type=media.mime_type)
        )
    else:
        raise ValueError("MediaRef needs either a uri or inline data")

    if video_metadata is not None:
        part.video_metadata = video_metadata
    return part


def resolve_media_resolution(media: Optional[MediaRef]) -> Optional[str]:
    """Map our short resolution name onto the API enum.

    Set on the request config rather than on the media part. Part-level
    `media_resolution` is accepted by Vertex but rejected by the Gemini
    Developer API with a 400, and since each window is its own call, config
    scope still gives per-window control — which is all the tiering needs.
    """
    name = (media.media_resolution if media else None) or config.ANNOTATION_MEDIA_RESOLUTION
    return _MEDIA_RESOLUTION_MAP.get(name.lower())


@dataclass
class GenerateResult:
    data: dict[str, Any]
    record: CallRecord


def generate_structured(
    *,
    model: str,
    prompt: str,
    response_schema: dict[str, Any],
    purpose: str,
    media: Optional[MediaRef] = None,
    system_instruction: Optional[str] = None,
    meter: Optional[UsageMeter] = None,
    thinking_level: Optional[str] = None,
    use_cache: bool = True,
    temperature: Optional[float] = None,
    cache_prompt: Optional[str] = None,
) -> GenerateResult:
    """Run one structured-output generation and meter it.

    Raises `RuntimeError` on a hard failure. Callers that annotate a live stream
    are expected to catch it and carry on rather than tear down the stream, since
    a dropped window is far cheaper than a dropped broadcast.
    """
    started = time.perf_counter()
    media_fp = media.fingerprint() if media else ""
    # `cache_prompt` lets a caller name the stable identity of the request when
    # the real prompt carries something that legitimately varies between runs.
    # Dense annotation is the case that matters: its prompt embeds a rolling
    # summary of previously completed windows, and because windows are
    # annotated concurrently, that summary depends on completion order. Keying
    # on the full prompt made the replay cache miss on nearly every window, so
    # the offline demo fallback silently degraded to almost no annotation.
    key = _cache_key(
        purpose,
        model,
        prompt if cache_prompt is None else cache_prompt,
        media_fp,
        system_instruction or "",
        thinking_level or "",
        "" if temperature is None else f"{temperature}",
    )

    if use_cache:
        cached = cache_read(key)
        if cached is not None:
            record = CallRecord(
                model=model,
                purpose=purpose,
                input_tokens=cached.get("input_tokens", 0),
                output_tokens=cached.get("output_tokens", 0),
                cached_tokens=0,
                cost_usd=0.0,
                latency_ms=(time.perf_counter() - started) * 1000,
                cache_hit=True,
            )
            if meter:
                meter.record(record)
            return GenerateResult(data=cached["data"], record=record)

    backend = get_backend()
    if backend == "replay":
        raise RuntimeError(
            f"Replay backend has no cached response for {purpose} "
            f"(key={key}). Warm the cache with real credentials first, or set "
            f"GEMINI_API_KEY / GCP_PROJECT."
        )

    from google.genai import types

    contents: list[Any] = []
    if media is not None:
        contents.append(_build_media_part(media))
    contents.append(types.Part(text=prompt))

    cfg_kwargs: dict[str, Any] = {
        "response_mime_type": "application/json",
        "response_schema": response_schema,
    }
    resolution = resolve_media_resolution(media)
    if media is not None and resolution:
        cfg_kwargs["media_resolution"] = resolution
    if system_instruction:
        cfg_kwargs["system_instruction"] = system_instruction
    if temperature is not None:
        cfg_kwargs["temperature"] = temperature
    if thinking_level:
        cfg_kwargs["thinking_config"] = types.ThinkingConfig(thinking_level=thinking_level)

    client = get_client()
    try:
        response = client.models.generate_content(
            model=model,
            contents=[types.Content(role="user", parts=contents)],
            config=types.GenerateContentConfig(**cfg_kwargs),
        )
    except Exception as exc:
        raise RuntimeError(f"Gemini call failed for {purpose}: {exc}") from exc

    latency_ms = (time.perf_counter() - started) * 1000
    usage = getattr(response, "usage_metadata", None)
    input_tokens = int(getattr(usage, "prompt_token_count", 0) or 0)
    output_tokens = int(getattr(usage, "candidates_token_count", 0) or 0)
    thoughts = int(getattr(usage, "thoughts_token_count", 0) or 0)
    cached_tokens = int(getattr(usage, "cached_content_token_count", 0) or 0)
    # Thinking tokens bill at the output rate, so they belong in the output total.
    output_tokens += thoughts

    text = getattr(response, "text", None)
    if not text:
        raise RuntimeError(
            f"Gemini returned no text for {purpose} "
            f"(likely a safety block or empty candidate list)"
        )
    try:
        data = json.loads(text)
    except json.JSONDecodeError as exc:
        raise RuntimeError(f"Gemini returned non-JSON for {purpose}: {exc}") from exc

    record = CallRecord(
        model=model,
        purpose=purpose,
        input_tokens=input_tokens,
        output_tokens=output_tokens,
        cached_tokens=cached_tokens,
        cost_usd=estimate_cost(model, input_tokens, output_tokens, cached_tokens),
        latency_ms=latency_ms,
    )
    if meter:
        meter.record(record)

    if use_cache:
        cache_write(
            key,
            {
                "data": data,
                "model": model,
                "purpose": purpose,
                "input_tokens": input_tokens,
                "output_tokens": output_tokens,
            },
        )

    return GenerateResult(data=data, record=record)


def health() -> dict[str, Any]:
    """Backend and model summary for the service health endpoint."""
    backend = get_backend()
    cached_entries = 0
    if os.path.isdir(config.ANNOTATION_CACHE_DIR):
        cached_entries = len(
            [f for f in os.listdir(config.ANNOTATION_CACHE_DIR) if f.endswith(".json")]
        )
    return {
        "backend": backend,
        "models": {
            "triage": config.GEMINI_TRIAGE_MODEL,
            "dense": config.GEMINI_DENSE_MODEL,
            "arbiter": config.GEMINI_ARBITER_MODEL,
        },
        "media_resolution": config.ANNOTATION_MEDIA_RESOLUTION,
        "annotation_fps": config.ANNOTATION_FPS,
        "cached_responses": cached_entries,
        "video_intelligence_enabled": config.USE_VIDEO_INTELLIGENCE,
    }
