# Substream Highlight Service

Automatic gameplay highlight reel generator powered by Google Cloud AI. Ingests gameplay recordings from Cloud Storage, identifies highlight-worthy moments using Video Intelligence API and Gemini 2.5, and assembles a 1-2 minute highlight reel with crossfade transitions and normalized audio.

## Architecture

1. **Ingestion** — Downloads gameplay video from GCS
2. **Scene Analysis** — Video Intelligence API (shot detection, label detection, text/OCR, object tracking)
3. **Audio Analysis** — Local RMS energy peak detection via pydub/numpy
4. **Segment Scoring** — Gemini 2.5 multimodal scoring of sampled frames per segment
5. **Highlight Selection** — Weighted score aggregation with temporal spread enforcement
6. **Assembly** — FFmpeg crossfade concatenation with loudnorm audio normalization

## API

```
POST /api/v1/highlights
{
  "video_uri": "gs://bucket/vr-recordings/session/gameplay.webm",
  "target_duration_seconds": 90,
  "game_title": "optional"
}
→ { "job_id": "uuid", "status": "pending" }

GET /api/v1/highlights/{job_id}
→ { "job_id": "...", "status": "completed", "highlight_url": "...", "segments": [...], "metadata": {...} }

GET /health
→ { "status": "ok" }
```

## Local Development

```bash
# Install dependencies
pip install -r requirements.txt

# Ensure ffmpeg is installed
ffmpeg -version

# Set GCP credentials
export GOOGLE_APPLICATION_CREDENTIALS=/path/to/service-account.json
export GCP_PROJECT=your-project-id

# Run the server
uvicorn main:app --reload --port 8080
```

## Environment Variables

| Variable | Default | Description |
|---|---|---|
| `GCP_PROJECT` | `bookvid-be-prod` | Google Cloud project ID |
| `GCP_REGION` | `us-central1` | Vertex AI region |
| `GCS_SOURCE_BUCKET` | `bookvid-prod-vr-recordings` | Source video bucket |
| `GCS_HIGHLIGHTS_BUCKET` | (same as source) | Output highlights bucket |
| `GCS_HIGHLIGHTS_PREFIX` | `highlights` | GCS path prefix for output |
| `GEMINI_MODEL` | `gemini-2.5-flash` | Gemini model for scoring |
| `DEFAULT_HIGHLIGHT_DURATION_SECONDS` | `90` | Default target reel length |
| `MAX_VIDEO_DURATION_SECONDS` | `3600` | Max accepted input length |
| `MIN_VIDEO_DURATION_SECONDS` | `60` | Min accepted input length |
| `SIGNED_URL_EXPIRY_SECONDS` | `3600` | Signed URL lifetime |

## Deploy to Cloud Run

```bash
# Build and push
gcloud builds submit --tag gcr.io/$GCP_PROJECT/highlight-service

# Deploy
gcloud run deploy highlight-service \
  --image gcr.io/$GCP_PROJECT/highlight-service \
  --region us-central1 \
  --memory 4Gi \
  --cpu 2 \
  --timeout 900 \
  --concurrency 1 \
  --set-env-vars GCP_PROJECT=$GCP_PROJECT
```

## Required GCP IAM Roles

The service account needs:
- `roles/storage.objectAdmin` — read source videos, write highlights
- `roles/aiplatform.user` — invoke Gemini via Vertex AI
- `roles/videointelligence.editor` — run Video Intelligence annotations
