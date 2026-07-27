# Highlight-as-a-Service: Technical Overview

## What It Does

The Highlight Service is a Python microservice that takes raw gameplay recordings (up to 60 minutes of video) and automatically produces a short 1-2 minute highlight reel. It uses Google Cloud AI to identify the most exciting, shareable moments — no manual editing, no game-specific rules. It works across any game genre.

## Architecture

```
                          ┌──────────────────────────────────────────────────┐
                          │         Highlight Service (Cloud Run)            │
                          │                                                  │
 ┌─────────┐   upload     │  ┌─────────┐    ┌──────────────────────────┐    │
 │ Frontend │────────────▶│  │ FastAPI  │───▶│ Pipeline Orchestrator    │    │
 │ (SPA)    │◀── poll ────│  │  API     │    │                          │    │
 └─────────┘              │  └─────────┘    │  1. Download from GCS    │    │
                          │                  │  2. Video Intelligence   │──▶ GCS
 ┌─────────┐   POST      │                  │  3. Audio Analysis       │    │
 │ IVS     │────────────▶│                  │  4. Gemini Scoring       │    │
 │ Backend │              │                  │  5. Highlight Selection  │    │
 └─────────┘              │                  │  6. FFmpeg Assembly      │    │
                          │                  └──────────────────────────┘    │
                          └──────────────────────────────────────────────────┘
```

Two integration paths:

1. **Direct upload** — The test frontend (or any client) uploads a video file via multipart POST. The service stores it in GCS, then processes it.
2. **GCS URI** — An existing backend (like the IVS recording pipeline) passes a `gs://` URI pointing to a recording already in Cloud Storage.

Both paths feed into the same 6-step pipeline.

## Tech Stack

| Layer | Technology | Why |
|-------|-----------|-----|
| **API Framework** | FastAPI + Uvicorn | Async Python, native background tasks, auto-generated OpenAPI docs |
| **Scene Analysis** | Gemini 3 (native video understanding) | Shot detection, on-screen text and object tracking come from the annotation model itself. Google Video Intelligence did this separately and is now off by default. |
| **Segment Scoring** | Vertex AI Gemini 3, tiered | A cheap triage pass over every window, a dense annotation model for the windows that earn it, and a pro-tier arbiter for final narrative scoring. Game-agnostic by design. |
| **Audio Analysis** | pydub + numpy (local) | RMS energy computation over sliding windows to detect volume peaks (explosions, cheering, music). No API cost. |
| **Video Processing** | FFmpeg (subprocess) | Segment cutting, crossfade transitions, audio normalization (loudnorm), H.264+AAC encoding |
| **Storage** | Google Cloud Storage | Source video ingestion, highlight output, signed URL delivery |
| **Deployment** | Cloud Run (Docker) | Scales to zero, uses GCP service account auth, 2 vCPU / 4GB RAM per instance |
| **Frontend** | Vanilla HTML/CSS/JS | Single-page app served by FastAPI's StaticFiles. No build step. |

## Pipeline Detail

### Step 1: Ingestion

The source video is downloaded from GCS to a temp directory on the Cloud Run instance. Accepted formats: `.webm`, `.mp4`, `.mov`. Duration limits: 1-60 minutes.

### Step 2: Scene Analysis (Video Intelligence API — disabled by default)

**This step no longer runs by default.** `USE_VIDEO_INTELLIGENCE` defaults to `false`: Gemini 3 does shot detection, on-screen text reading and object tracking natively, so the separate Video Intelligence call became redundant as well as expensive. The code path is retained behind the flag, and the description below applies only when it is switched back on. Steps 4 and 5 still describe consuming its output, which is stale — see the note under Step 5.

A single `annotate_video` call runs four detection features in parallel:

- **Shot change detection** — Finds natural scene boundaries. These become the atomic segments that the rest of the pipeline scores.
- **Label detection** (shot mode) — Identifies objects and actions per shot: "weapon", "explosion", "vehicle", "person", etc.
- **Text detection (OCR)** — Captures in-game text: scores, kill feeds, "Victory", "Game Over". High-signal for highlights.
- **Object tracking** — Tracks moving entities across frames. Density of tracked objects serves as an action-intensity proxy.

When enabled, this is the most expensive API call (~$0.10/min of video, so ~$3.00 for a 30-minute video — more than the entire pipeline costs without it). It runs as a long-running operation that typically completes in 2-5 minutes for a 30-minute video.

### Step 3: Audio Analysis (local, zero API cost)

FFmpeg extracts the audio track to WAV. Then pydub + numpy compute RMS energy over 1-second sliding windows (500ms hop). Peaks are detected as energy values exceeding 1.5x the mean, with a 3-second minimum gap between peaks to avoid clustering.

Audio peaks strongly correlate with highlight moments — explosions, kill sounds, crowd reactions, and music swells.

### Step 4: Segment Scoring (Gemini 2.5)

For each shot boundary from Step 2, the pipeline:

1. Extracts 3 representative JPEG frames from the segment
2. Gathers the Video Intelligence labels that overlap this segment
3. Computes the segment's audio energy score (0-1)
4. Sends all of this to Gemini 2.5 Flash with a structured prompt:

> "Rate this gameplay segment 0-100 for highlight-worthiness. Consider: action intensity, dramatic moments, visual excitement, social shareability."

Gemini returns a JSON response with a score and a short label (e.g., "intense firefight", "clutch victory").

This is the key design decision that makes the service **game-agnostic**. Rather than writing rules for each game genre ("detect headshots in FPS", "detect goals in sports"), we let a multimodal LLM interpret visual context. It understands explosions in Fortnite and goals in FIFA equally well.

### Step 5: Highlight Selection

Three scores are combined into a composite:

```
final_score = 0.4 * gemini_score + 0.3 * video_intel_score + 0.3 * audio_score
```

This composite, and Step 4's use of Video Intelligence labels as a scoring input, both describe the pipeline as it ran with Video Intelligence enabled. With that step off by default the `video_intel_score` term no longer has a source, and selection is driven by the tiered annotator instead. The live weighting is in the service code rather than here; this section has not been re-derived for the current path.

Segments are sorted by composite score, then greedily selected until the target duration is reached (default 90s). Two constraints ensure quality:

- **Minimum gap** — Selected segments must be at least 3 seconds apart (no redundant adjacent clips).
- **Temporal spread** — The source video is divided into thirds. No single third can contain more than 40% of the highlight reel's duration. This prevents the reel from being dominated by one section.

### Step 6: Assembly (FFmpeg)

Selected segments are cut from the source video, then concatenated with:

- **0.5s crossfade transitions** (video `xfade` + audio `acrossfade`) between clips
- **Audio normalization** via FFmpeg's `loudnorm` filter (ITU-R BS.1770-4, target -16 LUFS)
- **Output encoding**: H.264 CRF 23, AAC 192kbps, MP4 container with `faststart` for streaming

If crossfade fails (e.g., resolution mismatch between segments), the pipeline falls back to simple concatenation via the `concat` demuxer.

The final MP4 is uploaded to GCS and a signed URL (1-hour expiry) is returned.

## API Endpoints

| Method | Path | Purpose |
|--------|------|---------|
| `POST` | `/api/v1/highlights` | Start job from a GCS URI |
| `POST` | `/api/v1/highlights/upload` | Upload a video file and start a job |
| `GET` | `/api/v1/highlights` | List all jobs |
| `GET` | `/api/v1/highlights/{job_id}` | Poll job status and retrieve results |
| `GET` | `/health` | Health check |
| `GET` | `/` | Test frontend (static HTML) |

Processing is fully async. The POST returns a `job_id` immediately, and the client polls the GET endpoint. Job state transitions: `pending` → `processing` → `completed` | `failed`.

## Cost Model

All costs fall within the $80K Google Cloud credits.

Video Intelligence is disabled by default (`USE_VIDEO_INTELLIGENCE=false`), which removed roughly 85% of per-video cost. What remains is Gemini inference across the tiered annotator, plus effectively negligible storage and compute.

The Gemini line below is a **metered** figure, not an estimate: it comes from running four real gameplay titles end to end and reading the pipeline's own cost meter.

| Service | Unit Cost | 30-min Video |
|---------|----------|--------------|
| Gemini, tiered annotator (Vertex AI) | $5.10/stream-hour | ~$2.55 |
| Cloud Storage | ~$0.02/GB/month | negligible |
| Cloud Run | ~$0.00003/vCPU-sec | ~$0.05 |
| **Total per video** | | **~$2.60** |

Cost varies with how eventful the footage is, because the triage tier decides how many windows reach the expensive model. Measured range across titles: **$3.59/stream-hour** for sparse mobile gameplay up to **$8.31/stream-hour** for dense arena shooter footage.

Where the spend goes, per the cost meter: dense annotation 50%, narrative arbiter 31%, episode identification 12%, triage 7%. Triage is the majority of calls but a small minority of spend, which is the tiering working as intended.

At ~$2.60 per 30-minute video the $80K credits support roughly 30,000 highlight generations. Per-million-token rates for every model in the ladder live in `services/genai_client.py` and were verified against Google's published pricing in July 2026.

## Deployment

```bash
# Build and push to GCR
gcloud builds submit --tag gcr.io/$GCP_PROJECT/highlight-service \
  --project $GCP_PROJECT

# Deploy to Cloud Run
gcloud run deploy highlight-service \
  --image gcr.io/$GCP_PROJECT/highlight-service \
  --region us-central1 \
  --memory 4Gi \
  --cpu 2 \
  --timeout 900 \
  --concurrency 1 \
  --set-env-vars GCP_PROJECT=$GCP_PROJECT
```

The service account needs three IAM roles:
- `roles/storage.objectAdmin` — Read source videos, write highlights
- `roles/aiplatform.user` — Invoke Gemini via Vertex AI
- `roles/videointelligence.editor` — Run Video Intelligence annotations; only needed if `USE_VIDEO_INTELLIGENCE` is turned back on

## Configuration

All settings are environment variables with sensible defaults:

| Variable | Default | Notes |
|----------|---------|-------|
| `GCP_PROJECT` | `bookvid-be-prod` | Google Cloud project ID |
| `GCP_REGION` | `us-central1` | Vertex AI endpoint region |
| `GCS_SOURCE_BUCKET` | `bookvid-prod-vr-recordings` | Where source recordings live |
| `GCS_HIGHLIGHTS_BUCKET` | same as source | Where highlight output goes |
| `GEMINI_MODEL` | `gemini-3.1-pro-preview` | Also the default arbiter model |
| `GEMINI_TRIAGE_MODEL` | `gemini-3.5-flash-lite` | Cheap pass over every window |
| `GEMINI_DENSE_MODEL` | `gemini-3.6-flash` | The annotation workhorse |
| `USE_VIDEO_INTELLIGENCE` | `false` | Re-enables the separate Video Intelligence call |
| `DEFAULT_HIGHLIGHT_DURATION_SECONDS` | `90` | Target reel length |
| `MAX_VIDEO_DURATION_SECONDS` | `3600` | Reject inputs over 1 hour |
| `MIN_VIDEO_DURATION_SECONDS` | `60` | Reject inputs under 1 minute |

## Design Decisions and Trade-offs

**Why Gemini for scoring instead of a custom ML model?**
A custom model would need training data (thousands of labeled "highlight" / "not highlight" segments per game). Gemini already understands visual content across game genres with zero training. The trade-off is per-request API cost and latency — and since Video Intelligence came out of the pipeline, Gemini inference is now essentially the whole bill at ~$2.55 per 30-minute video, so it is worth metering rather than waving through as negligible.

**Why per-shot scoring instead of whole-video analysis?**
Gemini has context window limits. Sending a full 30-minute video would require the video-capable Gemini model with large context, which is slower and more expensive. By segmenting at shot boundaries and sending 3 frames per segment, we get faster results and can parallelize scoring in the future.

**Why FFmpeg via subprocess instead of ffmpeg-python?**
The `ffmpeg-python` library adds an abstraction layer but its filter graph API is awkward for complex operations like chained crossfades. Direct subprocess calls give full control over the FFmpeg CLI, which is well-documented and easier to debug. The service was initially scaffolded with `ffmpeg-python` in the dependency list but it was never used, so it was removed.

**Why in-memory job state instead of a database?**
For the prototype phase, an in-memory dict with TTL cleanup is simpler and has zero infrastructure cost. Jobs expire after 1 hour. For production, this would move to Firestore or Redis — but the API contract stays the same, so the frontend doesn't change.

**Why Cloud Run over GKE or Compute Engine?**
Cloud Run scales to zero (no cost when idle), handles container lifecycle automatically, and integrates with GCP IAM natively. The concurrency-1 setting ensures each instance handles one video at a time, avoiding CPU contention during FFmpeg encoding. The 15-minute request timeout is sufficient for videos up to 60 minutes.
