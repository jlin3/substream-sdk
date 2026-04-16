import json
import os

_creds_json = os.environ.get("GCP_CREDENTIALS_JSON")
if _creds_json and not os.environ.get("GOOGLE_APPLICATION_CREDENTIALS"):
    _creds_path = "/tmp/gcp-credentials.json"
    with open(_creds_path, "w") as f:
        f.write(_creds_json if _creds_json.strip().startswith("{") else json.dumps(json.loads(_creds_json)))
    os.environ["GOOGLE_APPLICATION_CREDENTIALS"] = _creds_path

GCP_PROJECT = os.environ.get("GCP_PROJECT", "bookvid-be")
GCP_REGION = os.environ.get("GCP_REGION", "us-central1")

GCS_SOURCE_BUCKET = os.environ.get("GCS_SOURCE_BUCKET", "bookvid-prod-vr-recordings")
GCS_HIGHLIGHTS_BUCKET = os.environ.get("GCS_HIGHLIGHTS_BUCKET", GCS_SOURCE_BUCKET)
GCS_HIGHLIGHTS_PREFIX = os.environ.get("GCS_HIGHLIGHTS_PREFIX", "highlights")

SIGNED_URL_EXPIRY_SECONDS = int(os.environ.get("SIGNED_URL_EXPIRY_SECONDS", "3600"))

# Legacy single-model config (kept for backward compat)
GEMINI_MODEL = os.environ.get("GEMINI_MODEL", "gemini-3.1-pro-preview")

# Whole-video highlight discovery model (Phase 1a)
GEMINI_DISCOVERY_MODEL = os.environ.get("GEMINI_DISCOVERY_MODEL", GEMINI_MODEL)
# Per-segment verification/scoring model (Phase 1c)
GEMINI_SCORING_MODEL = os.environ.get("GEMINI_SCORING_MODEL", GEMINI_MODEL)
# Quality review model (Phase 4a)
GEMINI_REVIEW_MODEL = os.environ.get("GEMINI_REVIEW_MODEL", GEMINI_MODEL)
# Fine-tuned model endpoint — when set, used for segment scoring instead of base model
GEMINI_TUNED_MODEL = os.environ.get("GEMINI_TUNED_MODEL", "")

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
