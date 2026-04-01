---
sidebar_position: 6
title: API Reference
---

# API Reference

All endpoints require an `Authorization: Bearer <token>` header.

**Base URL:** `https://substream-sdk-production.up.railway.app`

## Streaming

### Start a Stream (Web)

```
POST /api/streams/web-publish
```

Allocates an IVS Real-Time stage and returns a publish token for the web SDK.

**Request:**
```json
{
  "streamerId": "player-123",
  "orgId": "org-id",
  "title": "My Game Stream",
  "streamerName": "Player Name"
}
```

**Response:**
```json
{
  "streamId": "stream-abc-123",
  "stageArn": "arn:aws:ivs:...",
  "publishToken": "eyJ...",
  "viewerUrl": "https://...",
  "participantId": "...",
  "expiresAt": "2026-04-01T12:00:00Z",
  "region": "us-east-1"
}
```

### Stop a Stream (Web)

```
DELETE /api/streams/web-publish
```

**Request:**
```json
{ "streamId": "stream-abc-123" }
```

### Start a Stream (Unity WHIP)

```
POST /api/streams/whip
```

Returns a WHIP URL and media constraints for Unity WHIP ingest.

### Get Viewer Token

```
GET /api/streams/{streamId}/viewer
```

Returns a subscribe token for viewers to watch a live stream.

## Webhooks

### Register Webhook

```
POST /api/webhooks
```

**Request:**
```json
{
  "url": "https://your-app.com/webhooks",
  "events": ["stream.started", "stream.stopped"]
}
```

### List Webhooks

```
GET /api/webhooks
```

### Delete Webhook

```
DELETE /api/webhooks
```

**Request:**
```json
{ "url": "https://your-app.com/webhooks" }
```

## Organization

### Get Org Info

```
GET /api/orgs/{slug}
```

### List Streams

```
GET /api/orgs/{slug}/streams
```

### List Highlights

```
GET /api/orgs/{slug}/highlights
```

### Create Highlight

```
POST /api/orgs/{slug}/highlights
```

**Request:**
```json
{ "streamId": "stream-abc-123" }
```

### Get Highlight Detail

```
GET /api/orgs/{slug}/highlights/{id}
```

## Health

### Health Check

```
GET /api/health
```

Returns service status including database, AWS, IVS, and encryption status.

### Version

```
GET /api/version
```

Returns version metadata and feature flags.
