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

## Custom Models (Per-Game Tuning)

The base scoring model is game-agnostic and works out of the box. For your title,
you can fine-tune a model so "exciting" means what it means in your game — a
headshot in an FPS, a comeback in a racer, a boss kill in an RPG.

### How tuning works

1. **Collect examples** — Upload labelled segments that represent great moments
   from your game. Positive feedback on generated highlights is also captured
   automatically to grow the training set.
2. **Export & tune** — The highlight service exports the examples as JSONL and
   fine-tunes a Gemini model via the training API (`/api/v1/training/*`).
3. **Activate** — Set the `GEMINI_TUNED_MODEL` environment variable on the
   highlight service. When set, segment scoring uses your tuned model instead of
   the base model.

### Comparing models

The dashboard's **Highlights → Compare** view runs the base model and your tuned
model against the same recording so you can see, segment by segment, how much the
custom model improves selection before you roll it out.

The **Highlights → Training** view is where you upload examples and kick off a
tuning job.
