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

GEMINI_MODEL = os.environ.get("GEMINI_MODEL", "gemini-3.1-pro-preview")

MAX_VIDEO_DURATION_SECONDS = int(os.environ.get("MAX_VIDEO_DURATION_SECONDS", "3600"))
MIN_VIDEO_DURATION_SECONDS = int(os.environ.get("MIN_VIDEO_DURATION_SECONDS", "60"))
DEFAULT_HIGHLIGHT_DURATION_SECONDS = int(os.environ.get("DEFAULT_HIGHLIGHT_DURATION_SECONDS", "90"))

TEMP_DIR = os.environ.get("TEMP_DIR", "/tmp/highlight-service")
