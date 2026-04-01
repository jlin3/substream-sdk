---
sidebar_position: 3
title: AI Highlights
---

# AI Highlights

The highlight service analyzes recordings and generates polished highlight reels with the best moments automatically.

## How It Works

1. **Scene Analysis** — Google Cloud Video Intelligence detects shots, labels, text, and objects
2. **Audio Analysis** — Local RMS energy analysis identifies moments of high audio intensity
3. **AI Scoring** — Gemini scores each segment based on visual action and game context
4. **Selection** — Weighted scoring (50% AI, 25% video intelligence, 25% audio) picks the best moments
5. **Assembly** — FFmpeg compiles selected segments with crossfade transitions and audio normalization

## Generating Highlights

**Dashboard:** Navigate to any recording and click **Generate Highlight**. The highlight job will appear under **Highlights** with status tracking.

**API:**

```bash
POST /api/orgs/{slug}/highlights
Content-Type: application/json

{
  "streamId": "stream-id-here"
}
```

## Highlight States

| Status | Description |
|--------|-------------|
| `PENDING` | Job queued |
| `PROCESSING` | AI analysis and assembly in progress |
| `COMPLETED` | Highlight reel ready for playback |
| `FAILED` | Processing failed (check logs) |

## Pipeline Visualization

The dashboard shows a detailed pipeline visualization for each highlight, including processing steps, segment scores, and which segments were selected vs skipped.
