import json
import os

# Load .env before reading anything below, so a local file can supply
# GEMINI_API_KEY without every entry point having to export it first. Real
# environment variables still win, which keeps deployed config authoritative.
try:
    from dotenv import load_dotenv

    for _candidate in (
        os.path.join(os.path.dirname(__file__), ".env"),
        os.path.join(os.path.dirname(os.path.dirname(__file__)), ".env"),
    ):
        if os.path.isfile(_candidate):
            load_dotenv(_candidate, override=False)
except ImportError:
    pass

_creds_json = os.environ.get("GCP_CREDENTIALS_JSON")
if _creds_json and not os.environ.get("GOOGLE_APPLICATION_CREDENTIALS"):
    _creds_path = "/tmp/gcp-credentials.json"
    with open(_creds_path, "w") as f:
        f.write(_creds_json if _creds_json.strip().startswith("{") else json.dumps(json.loads(_creds_json)))
    os.environ["GOOGLE_APPLICATION_CREDENTIALS"] = _creds_path

# Infrastructure values are operator-specific and must come from the
# environment. Defaulting these to a real project or bucket name silently points
# the service at someone else's infrastructure, so the defaults stay empty and
# backend resolution degrades to replay mode instead.
GCP_PROJECT = os.environ.get("GCP_PROJECT", "")
GCP_REGION = os.environ.get("GCP_REGION", "us-central1")

GCS_SOURCE_BUCKET = os.environ.get("GCS_SOURCE_BUCKET", "")
GCS_HIGHLIGHTS_BUCKET = os.environ.get("GCS_HIGHLIGHTS_BUCKET", GCS_SOURCE_BUCKET)
GCS_HIGHLIGHTS_PREFIX = os.environ.get("GCS_HIGHLIGHTS_PREFIX", "highlights")

SIGNED_URL_EXPIRY_SECONDS = int(os.environ.get("SIGNED_URL_EXPIRY_SECONDS", "3600"))

# --- Gemini models -------------------------------------------------------
#
# Three tiers, chosen so that per-hour annotation cost stays bounded:
#   triage    cheap pass over every window to decide what deserves attention
#   dense     the SWA-1 annotation workhorse
#   arbiter   final narrative scoring, only on candidate spans
#
# gemini-3.5-pro is not referenced here on purpose. It is still limited to
# enterprise preview, so it stays a config swap rather than a dependency.
GEMINI_MODEL = os.environ.get("GEMINI_MODEL", "gemini-3.1-pro-preview")

GEMINI_TRIAGE_MODEL = os.environ.get("GEMINI_TRIAGE_MODEL", "gemini-3.5-flash-lite")
GEMINI_DENSE_MODEL = os.environ.get("GEMINI_DENSE_MODEL", "gemini-3.6-flash")
GEMINI_ARBITER_MODEL = os.environ.get("GEMINI_ARBITER_MODEL", GEMINI_MODEL)

# Whole-video highlight discovery model
GEMINI_DISCOVERY_MODEL = os.environ.get("GEMINI_DISCOVERY_MODEL", GEMINI_MODEL)
# Per-segment verification/scoring model
GEMINI_SCORING_MODEL = os.environ.get("GEMINI_SCORING_MODEL", GEMINI_DENSE_MODEL)
# Quality review model
GEMINI_REVIEW_MODEL = os.environ.get("GEMINI_REVIEW_MODEL", GEMINI_MODEL)
# Fine-tuned model endpoint — when set, used for segment scoring instead of base model
GEMINI_TUNED_MODEL = os.environ.get("GEMINI_TUNED_MODEL", "")

# Backend selection. "vertex" uses ADC + GCP_PROJECT, "api" uses GEMINI_API_KEY,
# "replay" serves cached annotations from disk so the demo runs with no creds.
GEMINI_BACKEND = os.environ.get("GEMINI_BACKEND", "auto")
GEMINI_API_KEY = os.environ.get("GEMINI_API_KEY", "")
# Location for preview models, which are only served from the global endpoint.
GEMINI_GLOBAL_LOCATION = os.environ.get("GEMINI_GLOBAL_LOCATION", "global")

# Replay cache. When populated, annotation reads from here instead of calling
# the API. This backs the offline demo fallback.
ANNOTATION_CACHE_DIR = os.environ.get(
    "ANNOTATION_CACHE_DIR",
    os.path.join(os.path.dirname(__file__), "demo_cache"),
)

# --- Annotation windowing ------------------------------------------------
TRIAGE_WINDOW_SECONDS = float(os.environ.get("TRIAGE_WINDOW_SECONDS", "4.0"))
DENSE_WINDOW_SECONDS = float(os.environ.get("DENSE_WINDOW_SECONDS", "8.0"))
DENSE_WINDOW_OVERLAP_SECONDS = float(os.environ.get("DENSE_WINDOW_OVERLAP_SECONDS", "4.0"))
# Windows scoring below this in triage skip dense annotation entirely.
TRIAGE_SALIENCE_THRESHOLD = int(os.environ.get("TRIAGE_SALIENCE_THRESHOLD", "35"))
# Frame sampling rate handed to the model. 1.0 matches Gemini's native cadence.
ANNOTATION_FPS = float(os.environ.get("ANNOTATION_FPS", "1.0"))
# "low" is 70 tokens/frame and is enough for motion and action. "high" is 280
# and is only worth it when HUD text has to be read reliably.
ANNOTATION_MEDIA_RESOLUTION = os.environ.get("ANNOTATION_MEDIA_RESOLUTION", "low")
ANNOTATION_MAX_CONCURRENCY = int(os.environ.get("ANNOTATION_MAX_CONCURRENCY", "6"))

# Dense annotation is the single largest cost line, and its output tokens —
# which include thinking tokens — dominate it. Gemini 3 defaults to dynamic
# thinking, which measured 2x the cost of "low" across 9 windows and 3 titles
# for no gain in events, entities or OCR fields recovered. See
# scripts/probe_thinking_level.py to re-run that comparison. Raise this if a
# genre turns out to need deliberation the transcript does not show.
DENSE_THINKING_LEVEL = os.environ.get("DENSE_THINKING_LEVEL", "low")

# --- Video Intelligence --------------------------------------------------
# Off by default. At roughly $0.10/minute it dominated per-video cost, and
# Gemini 3 already performs shot detection, on-screen text reading and object
# tracking natively as part of the annotation pass.
USE_VIDEO_INTELLIGENCE = os.environ.get("USE_VIDEO_INTELLIGENCE", "false").lower() == "true"

MAX_VIDEO_DURATION_SECONDS = int(os.environ.get("MAX_VIDEO_DURATION_SECONDS", "3600"))
MIN_VIDEO_DURATION_SECONDS = int(os.environ.get("MIN_VIDEO_DURATION_SECONDS", "60"))
DEFAULT_HIGHLIGHT_DURATION_SECONDS = int(os.environ.get("DEFAULT_HIGHLIGHT_DURATION_SECONDS", "90"))

TEMP_DIR = os.environ.get("TEMP_DIR", "/tmp/highlight-service")

# Quality review
QUALITY_REVIEW_THRESHOLD = int(os.environ.get("QUALITY_REVIEW_THRESHOLD", "60"))
QUALITY_REVIEW_MAX_RETRIES = int(os.environ.get("QUALITY_REVIEW_MAX_RETRIES", "1"))

# Persistent job storage
USE_FIRESTORE = os.environ.get("USE_FIRESTORE", "false").lower() == "true"
FIRESTORE_COLLECTION = os.environ.get("FIRESTORE_COLLECTION", "highlight_jobs")

# Training data
GCS_TRAINING_BUCKET = os.environ.get("GCS_TRAINING_BUCKET", GCS_SOURCE_BUCKET)
GCS_TRAINING_PREFIX = os.environ.get("GCS_TRAINING_PREFIX", "training-data")

# Assembly presets
DEFAULT_OUTPUT_PRESET = os.environ.get("DEFAULT_OUTPUT_PRESET", "standard")

# Webhook delivery
WEBHOOK_TIMEOUT_SECONDS = int(os.environ.get("WEBHOOK_TIMEOUT_SECONDS", "30"))

# AWS S3 configuration (for recordings from IVS)
AWS_REGION = os.environ.get("AWS_REGION", "us-east-1")
S3_RECORDING_BUCKET = os.environ.get("S3_RECORDING_BUCKET", "")
