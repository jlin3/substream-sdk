# Web Game Streaming Demo

Stream any HTML5 canvas game to parents in real-time via AWS IVS.

---

## Quick Start (Try the Demo)

```bash
cd examples/web-game-demo
python3 -m http.server 8080
open http://localhost:8080
```

Click **Start Streaming**. The demo connects to the live backend, allocates an IVS Real-Time stage, and begins publishing the canvas feed. A viewer URL appears once the stream is live.

### Demo Credentials (pre-configured)

| Field | Value |
|-------|-------|
| Backend URL | `https://substream-sdk-production.up.railway.app` |
| Child ID | `demo-child-001` |
| Auth Token | `demo-token` (hardcoded in the demo) |

---

## Add Streaming to Your Existing Game (3 Steps)

This works with **any** game that renders to a `<canvas>` element -- Phaser, Three.js, PixiJS, Unity WebGL, Cocos, Construct, or plain canvas.

### Step 1: Add two script tags

```html
<!-- IVS Web Broadcast SDK (handles WebRTC publishing) -->
<script src="https://web-broadcast.live-video.net/1.32.0/amazon-ivs-web-broadcast.js"></script>

<!-- Substream integration (one-file, zero dependencies) -->
<script src="substream.js"></script>
```

Copy `substream.js` from this directory into your project, or reference it from the repo.

### Step 2: Start streaming

```javascript
const session = await Substream.startStream({
  canvas: document.getElementById('game-canvas'),  // your game's canvas element
  backendUrl: 'https://substream-sdk-production.up.railway.app',
  childId: 'demo-child-001',   // your player's ID
  authToken: 'demo-token',     // your auth token
  onLive: ({ viewerUrl }) => {
    console.log('Stream is live! Viewer URL:', viewerUrl);
    // Show viewerUrl to the parent, send via API, etc.
  },
});
```

### Step 3: Stop streaming

```javascript
await session.stop();
```

That's it. No npm install, no build step, no configuration files.

---

## Complete Integration Example

Here's a full working HTML page that integrates streaming into a Phaser game:

```html
<!DOCTYPE html>
<html>
<head>
  <title>My Game with Streaming</title>
</head>
<body>
  <canvas id="game-canvas" width="1280" height="720"></canvas>
  <button id="stream-btn">Start Streaming</button>
  <p id="stream-status"></p>

  <!-- Your game engine -->
  <script src="https://cdn.jsdelivr.net/npm/phaser@3/dist/phaser.min.js"></script>

  <!-- Streaming (two script tags) -->
  <script src="https://web-broadcast.live-video.net/1.32.0/amazon-ivs-web-broadcast.js"></script>
  <script src="substream.js"></script>

  <script>
    // --- Your game code (unchanged) ---
    const game = new Phaser.Game({
      type: Phaser.AUTO,  // CANVAS or WEBGL -- both work
      canvas: document.getElementById('game-canvas'),
      width: 1280,
      height: 720,
      scene: {
        create() { this.add.text(100, 100, 'My Game', { fontSize: 48 }); }
      }
    });

    // --- Streaming integration (add this) ---
    let session = null;
    const btn = document.getElementById('stream-btn');
    const status = document.getElementById('stream-status');

    btn.onclick = async () => {
      if (session) {
        await session.stop();
        session = null;
        btn.textContent = 'Start Streaming';
        status.textContent = 'Stream stopped.';
        return;
      }

      btn.disabled = true;
      status.textContent = 'Connecting...';

      try {
        session = await Substream.startStream({
          canvas: document.getElementById('game-canvas'),
          backendUrl: 'https://substream-sdk-production.up.railway.app',
          childId: 'demo-child-001',
          authToken: 'demo-token',
          onLive: ({ viewerUrl }) => {
            status.innerHTML = 'LIVE! <a href="' + viewerUrl + '" target="_blank">Open viewer</a>';
          },
        });
        btn.textContent = 'Stop Streaming';
      } catch (err) {
        status.textContent = 'Error: ' + err.message;
      }
      btn.disabled = false;
    };
  </script>
</body>
</html>
```

### Three.js

```javascript
const renderer = new THREE.WebGLRenderer({
  canvas: document.getElementById('game-canvas'),
});
// The renderer draws to the canvas; Substream captures it automatically.
// Just call Substream.startStream() with the same canvas element.
```

### Unity WebGL

After the Unity WebGL build loads and renders to its canvas:

```javascript
const unityCanvas = document.querySelector('#unity-canvas');
const session = await Substream.startStream({
  canvas: unityCanvas,
  backendUrl: 'https://substream-sdk-production.up.railway.app',
  childId: 'demo-child-001',
  authToken: 'demo-token',
});
```

### PixiJS / Cocos / Construct

All render to `<canvas>`. Pass your canvas element to `Substream.startStream()` -- everything else is identical.

---

## How It Works

```
Canvas Game (browser)
    |
    |  canvas.captureStream(30fps)
    v
MediaStream (video track)
    |
    |  IVS Web Broadcast SDK  (Stage + LocalStageStream)
    v
AWS IVS Real-Time Stage
    |
    |  WebRTC subscribe
    v
Viewer Page (parent's browser)
```

`captureStream()` works on both 2D canvas and WebGL canvas in all modern browsers (Chrome, Firefox, Safari, Edge).

---

## Production Auth

The demo uses hardcoded `demo-token` / `demo-child-001` credentials. For production:

1. **Your backend authenticates the player** and issues a JWT or session token.
2. **Pass that token as `authToken`** to `Substream.startStream()`. The Substream backend validates it before allocating a stage.
3. **The `childId` maps to your player's ID** in your system. The backend uses it to determine which parent(s) can view the stream.

The Substream backend validates tokens in `IVSBackend/src/app/api/streams/web-publish/route.ts`. In the current implementation, `demo-token` + `demo-child-001` is a hardcoded demo bypass. For production, replace the `validateAuth()` function with your JWT verification logic.

```
Your Game  --(authToken + childId)--> Substream Backend  --(validate)--> Your Auth Service
```

---

## Webhook Integration

Get notified when streams start/stop and viewers join/leave:

```bash
curl -X POST https://substream-sdk-production.up.railway.app/api/webhooks \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://your-app.com/hooks/substream",
    "events": ["stream.started", "stream.stopped", "viewer.joined", "viewer.left"]
  }'
```

Your endpoint receives signed POST requests:

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

Verify `X-Substream-Signature` with HMAC-SHA256 using the `secret` from registration.

---

## Preflight Checks

The demo page runs automated checks on load:

| Check | What it verifies |
|-------|-----------------|
| Protocol | Page served over HTTP/HTTPS (not `file://`) |
| captureStream | `canvas.captureStream()` API available |
| IVS SDK | IVS Web Broadcast SDK loaded from CDN |
| Backend | `/api/health` reachable and returning `status: ok` |
| Stage | IVS Real-Time stage connected (after clicking Start) |

---

## Using the TypeScript SDK (npm)

For TypeScript projects with a build step, use `@substream/web-sdk` instead:

```bash
npm install amazon-ivs-web-broadcast
# Then copy packages/web-sdk/ into your project (not yet on npm)
```

```typescript
import { SubstreamSDK } from '@substream/web-sdk';

const stream = await SubstreamSDK.startStream({
  backendUrl: 'https://substream-sdk-production.up.railway.app',
  canvasElement: document.getElementById('game-canvas') as HTMLCanvasElement,
  childId: 'child-123',
  authToken: 'jwt-token',
  onLive: ({ viewerUrl }) => console.log('Live at', viewerUrl),
});

await stream.stop();
```

See `packages/web-sdk/` for the full typed API.
