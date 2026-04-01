---
sidebar_position: 4
title: Webhooks
---

# Webhooks

Register HTTP endpoints to receive real-time notifications when streaming events occur.

## Registering a Webhook

```bash
POST /api/webhooks
Authorization: Bearer your-token
Content-Type: application/json

{
  "url": "https://your-app.com/webhooks/substream",
  "events": ["stream.started", "stream.stopped", "viewer.joined", "viewer.left"]
}
```

## Events

| Event | Fires When | Payload |
|-------|-----------|---------|
| `stream.started` | A stream goes live | `{ streamId, streamerId, title, startedAt }` |
| `stream.stopped` | A stream ends | `{ streamId, streamerId, endedAt, durationSecs }` |
| `viewer.joined` | A viewer starts watching | `{ streamId, viewerId, joinedAt }` |
| `viewer.left` | A viewer stops watching | `{ streamId, viewerId, leftAt, watchDurationSecs }` |

## Security

All webhook payloads are HMAC-signed. Verify the signature in the `X-Substream-Signature` header:

```javascript
const crypto = require('crypto');

function verifyWebhook(payload, signature, secret) {
  const expected = crypto
    .createHmac('sha256', secret)
    .update(JSON.stringify(payload))
    .digest('hex');
  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expected)
  );
}
```

## Managing Webhooks

```bash
# List registered webhooks
GET /api/webhooks

# Delete a webhook
DELETE /api/webhooks
Content-Type: application/json
{ "url": "https://your-app.com/webhooks/substream" }
```
