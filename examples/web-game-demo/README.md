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

## Add Streaming to Your Existing Game (4 Steps)

This works with **any** game that renders to a `<canvas>` element -- Phaser, Three.js, PixiJS, Unity WebGL, Cocos, Construct, or plain canvas. Video and audio are both captured.

### Step 1: Add two script tags and enable audio capture

```html
<!-- IVS Web Broadcast SDK (handles WebRTC publishing) -->
<script src="https://web-broadcast.live-video.net/1.32.0/amazon-ivs-web-broadcast.js"></script>

<!-- Substream integration (one-file, zero dependencies) -->
<script src="substream.js"></script>

<!-- Enable audio capture BEFORE the game engine loads -->
<script>Substream.captureAudio();</script>
```

Copy `substream.js` from this directory into your project, or reference it from the repo.

**Important:** `Substream.captureAudio()` must be called **before** the game engine creates its AudioContext. This patches `AudioNode.connect` to tee game audio into a capturable stream while still playing through speakers normally.

### Step 2: Load your game engine

Load Unity WebGL, Phaser, Three.js, etc. after the `captureAudio()` call.

### Step 3: Start streaming

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

### Step 4: Stop streaming

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

  <!-- 1. Streaming SDKs (load BEFORE the game engine) -->
  <script src="https://web-broadcast.live-video.net/1.32.0/amazon-ivs-web-broadcast.js"></script>
  <script src="substream.js"></script>
  <script>Substream.captureAudio();</script>

  <!-- 2. Game engine (loads AFTER captureAudio so game audio is captured) -->
  <script src="https://cdn.jsdelivr.net/npm/phaser@3/dist/phaser.min.js"></script>

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

Step 1: Add the streaming SDKs and audio capture
Add the following at the end of the <head> of your HTML:
<!-- Streaming SDKs + audio capture -->
<script src="https://web-broadcast.live-video.net/1.32.0/amazon-ivs-web-broadcast.js"></script>
<script src="substream.js"></script>
<script>Substream.captureAudio();</script>

Step 2: Make sure your Unity canvas exists in the <body> of your HTML:
<div id="unity-container">
  <canvas id="unity-canvas" width="960" height="600"></canvas>
</div>

Step 3: Add the streaming start/stop setup
Add the following inside the .then() callback of createUnityInstance(), right after Unity has loaded:
// --- Substream streaming integration ---
let session = null;

async function startStreaming() {
  session = await Substream.startStream({
    canvas: canvas,
    backendUrl: 'https://substream-sdk-production.up.railway.app',
    childId: 'demo-child-001',
    authToken: 'demo-token',
    onLive: ({ viewerUrl }) => {
      console.log('Stream is live! Viewer URL:', viewerUrl);
      alert('Stream live! Open: ' + viewerUrl);
    },
  });
}

async function stopStreaming() {
  if (session) {
    await session.stop();
    session = null;
    console.log('Stream stopped');
  }
}

// Expose functions to buttons or UI
window.startStreaming = startStreaming;
window.stopStreaming = stopStreaming;


Step 4: Optional — Add buttons in your HTML to start/stop streaming
Add the following in the <body> before <script>:
<!-- Start/Stop buttons for streaming -->
<div id="stream-controls" style="margin: 10px;">
  <button onclick="startStreaming()">Start Streaming</button>
  <button onclick="stopStreaming()">Stop Streaming</button>
</div>

### PixiJS / Cocos / Construct

All render to `<canvas>`. Pass your canvas element to `Substream.startStream()` -- everything else is identical.

---

## How It Works

```
Canvas Game (browser)
    |
    ├── canvas.captureStream(30fps) ──> video track
    |
    └── AudioContext.destination ──> (monkey-patched) ──> audio track
                                         |
                                         ├── speakers (unchanged)
                                         └── MediaStreamAudioDestinationNode
    |
    v
Combined MediaStream (video + audio tracks)
    |
    |  IVS Web Broadcast SDK  (Stage + LocalStageStream per track)
    v
AWS IVS Real-Time Stage
    |
    |  WebRTC subscribe (video + audio)
    v
Viewer Page (parent's browser)
```

- `captureStream()` captures video from both 2D canvas and WebGL canvas.
- `Substream.captureAudio()` patches `AudioNode.connect` to tee any audio routed to the speakers into a capturable `MediaStream`. Game audio plays through speakers normally.
- Both tracks are published to the IVS stage and received by the viewer.

---

## Audio Capture

### Why is this needed?

`canvas.captureStream()` only captures video. Game engines (Unity WebGL, Phaser, etc.) play audio through the Web Audio API's `AudioContext`, which is completely separate from the canvas. Without `captureAudio()`, the stream has video but silent audio.

### How it works

`Substream.captureAudio()` monkey-patches `AudioNode.prototype.connect`. When any audio node connects to `AudioContext.destination` (the speakers), the patch also connects it to a `MediaStreamAudioDestinationNode`. This creates an audio track that mirrors what plays through the speakers, without affecting the game's audio at all.

### Troubleshooting audio

| Symptom | Cause | Fix |
|---------|-------|-----|
| No audio on viewer | `captureAudio()` not called, or called after game engine loaded | Move `Substream.captureAudio()` BEFORE the game engine's script tag |
| Audio on viewer is muted | Browser autoplay policy | Click the "Unmute" button on the viewer page |
| Audio captured but silent | Game hasn't started playing audio yet | Audio only appears once the game actually triggers sound (e.g. after user interaction) |
| Some audio missing | Game uses multiple AudioContexts or Web Audio nodes that don't route through destination | Uncommon; most engines route all audio through a single AudioContext |

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
