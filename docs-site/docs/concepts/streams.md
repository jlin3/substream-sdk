---
sidebar_position: 1
title: Streams
---

# Streams

A stream is created when a player starts broadcasting. The SDK captures the canvas (or Unity camera), encodes it via WebRTC, and publishes to an IVS Real-Time stage.

## Lifecycle

1. **Start** — SDK calls `POST /api/streams/web-publish` (or `/api/streams/whip` for Unity)
2. **Allocate** — Backend allocates an IVS Real-Time stage and returns a publish token
3. **Publish** — SDK connects to the stage via WebRTC and starts sending video/audio
4. **Live** — Stream is visible in the dashboard with a LIVE badge; viewers can watch
5. **Stop** — SDK calls `DELETE /api/streams/web-publish`; stage is released
6. **Record** — IVS automatically records the stream to S3; it appears in Recordings

## Stream States

| Status | Description |
|--------|-------------|
| `IDLE` | Stream created but not yet broadcasting |
| `LIVE` | Currently broadcasting |
| `ENDED` | Stream stopped, waiting for recording |
| `RECORDED` | Recording available for playback |

## Webhooks

Register webhook endpoints to get notified when streams change state:

- `stream.started` — Fires when a stream goes live
- `stream.stopped` — Fires when a stream ends
- `viewer.joined` — Fires when a viewer starts watching
- `viewer.left` — Fires when a viewer stops watching

See [Webhooks](./webhooks) for setup details.
