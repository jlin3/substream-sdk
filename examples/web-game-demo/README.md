# Web Game Streaming Demo

Stream any HTML5 canvas game to parents in real-time via AWS IVS.

This demo shows a Breakout-style game rendered on a `<canvas>` element, captured with `canvas.captureStream()`, and published to an IVS Real-Time stage using the IVS Web Broadcast SDK. Parents receive a viewer URL and watch via WebRTC with sub-second latency.

---

## Quick Start

```bash
# 1. Serve the demo over HTTP (required for WebRTC)
cd examples/web-game-demo
python3 -m http.server 8080

# 2. Open in your browser
open http://localhost:8080
```

Click **Start Streaming**. The demo connects to the live backend, allocates an IVS stage, and begins publishing the canvas feed. A viewer URL is displayed once the stream is live.

### Demo Credentials (pre-configured)

| Field | Value |
|-------|-------|
| Backend URL | `https://substream-sdk-production.up.railway.app` |
| Child ID | `demo-child-001` |
| Auth Token | `demo-token` (hardcoded in the demo) |

---

## How It Works

```
Canvas Game (browser)
    |
    |  canvas.captureStream(30fps)
    v
MediaStream
    |
    |  IVS Web Broadcast SDK (Stage + LocalStageStream)
    v
AWS IVS Real-Time Stage
    |
    |  WebRTC subscribe
    v
Viewer Page (parent's browser)
```

1. The game draws frames to a `<canvas>` element at 1280x720.
2. `canvas.captureStream(30)` produces a `MediaStream` with a video track.
3. The IVS Web Broadcast SDK wraps that track as a `LocalStageStream` and publishes it to an IVS Real-Time stage.
4. Parents open the viewer URL, which subscribes to the same stage and renders the video.

---

## Integrating Your Own Game

Any game that renders to a `<canvas>` element works. Replace the Breakout game with your engine:

### Phaser

```html
<script src="https://cdn.jsdelivr.net/npm/phaser@3/dist/phaser.min.js"></script>
<script>
  const config = {
    type: Phaser.CANVAS, // must be CANVAS, not WEBGL
    canvas: document.getElementById('game-canvas'),
    width: 1280,
    height: 720,
    scene: { /* your scenes */ }
  };
  const game = new Phaser.Game(config);
</script>
```

### Three.js

```javascript
const renderer = new THREE.WebGLRenderer({
  canvas: document.getElementById('game-canvas'),
});
// renderer draws to the same canvas; captureStream() captures it
```

### Unity WebGL

Unity WebGL builds render to a canvas element. After the build loads:

```javascript
const unityCanvas = document.querySelector('#unity-canvas');
// Pass unityCanvas to captureStream() the same way
```

### PixiJS / Cocos / Construct

All of these render to `<canvas>`. Point `captureStream()` at the canvas element and the rest is identical.

---

## Preflight Checks

The demo runs automated checks on load:

| Check | What it verifies |
|-------|-----------------|
| Protocol | Page served over HTTP/HTTPS (not `file://`) |
| captureStream | `canvas.captureStream()` API available in the browser |
| IVS SDK | IVS Web Broadcast SDK loaded from CDN |
| Backend | `/api/health` endpoint reachable and returning `status: ok` |
| Stage | IVS Real-Time stage connected (after clicking Start) |

If any check fails, the event log panel shows the specific error.

---

## Webhook Integration

Register a webhook to receive stream lifecycle events:

```bash
# Register
curl -X POST https://substream-sdk-production.up.railway.app/api/webhooks \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://your-app.com/hooks/substream",
    "events": ["stream.started", "stream.stopped", "viewer.joined"]
  }'

# Response includes a secret for HMAC verification
```

Your endpoint receives POST requests with signed payloads:

```json
{
  "id": "a1b2c3d4-...",
  "event": "stream.started",
  "timestamp": "2026-02-18T20:00:00Z",
  "data": {
    "streamId": "...",
    "childId": "demo-child-001",
    "viewerUrl": "https://..."
  }
}
```

Verify the `X-Substream-Signature` header using HMAC-SHA256 with your secret.

---

## Requirements

- A modern browser (Chrome, Firefox, Safari, Edge)
- HTTP server (not `file://`) -- `python3 -m http.server` works fine
- Network access to the backend (or run `IVSBackend/` locally)

---

## Using the Web SDK Package

For production integration, use the `@substream/web-sdk` TypeScript package instead of the raw IVS SDK:

```typescript
import { SubstreamSDK } from '@substream/web-sdk';

const stream = await SubstreamSDK.startStream({
  backendUrl: 'https://your-backend.example.com',
  canvasElement: document.getElementById('game-canvas'),
  childId: 'child-123',
  authToken: 'jwt-token',
  onLive: ({ viewerUrl }) => console.log('Live at', viewerUrl),
});

// Later
await stream.stop();
```

See `packages/web-sdk/` for the full API.
