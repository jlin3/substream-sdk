---
sidebar_position: 2
title: Recordings
---

# Recordings

Every stream is automatically recorded to the cloud via IVS. Once a stream ends, the recording appears in the dashboard under **Recordings**.

## How It Works

1. IVS records every stage session to S3 automatically
2. When the stream ends, the backend updates the stream record with the recording URL
3. The recording is playable as a VOD in the dashboard
4. Recordings can be used as input for AI highlight generation

## Accessing Recordings

**Dashboard:** Navigate to **Recordings** to browse all recorded streams.

**API:** Use the streams endpoint to get recording URLs:

```bash
GET /api/orgs/{slug}/streams
```

Each stream with status `RECORDED` includes a `recordingUrl` field.

## Storage

Recordings are stored in S3 and served via CloudFront (when configured). The default retention is unlimited — recordings persist until manually deleted.
