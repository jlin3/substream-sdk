# IVS Streaming Demo Guide

This guide shows how to demo the IVS streaming system step-by-step.

## Demo Options

| Demo Level | What It Shows | Requirements |
|------------|---------------|--------------|
| **Level 0: Web Game** | Canvas game streaming end-to-end | Browser only (no backend setup) |
| **Level 1: API Only** | Backend works, API responses | Database only |
| **Level 2: External Stream** | Full IVS pipeline | AWS credentials + OBS/FFmpeg |
| **Level 3: Unity Integration** | Complete system | All above + native FFmpeg lib |

---

## Level 0: Web Game Demo (Easiest -- No Setup)

This demonstrates the full streaming pipeline using a browser-based canvas game.
No backend setup, no Unity, no AWS credentials needed on your machine -- everything
uses the live hosted backend.

### Step 1: Serve the Demo

```bash
cd examples/web-game-demo
python3 -m http.server 8080
```

### Step 2: Open in Browser

Navigate to `http://localhost:8080`. You should see:
- A Breakout-style game rendering on a canvas
- Preflight checks (all green if setup is correct)
- An event log panel

### Step 3: Start Streaming

Click **Start Streaming**. The demo will:
1. Request a publish token from the live backend
2. Capture the canvas at 30fps via `canvas.captureStream()`
3. Publish to an IVS Real-Time stage via WebRTC
4. Display a **Viewer URL** that parents can open to watch

### Step 4: Watch the Stream

Open the displayed Viewer URL in a second browser tab (or send it to someone).
They will see the game in real-time with sub-second latency.

### What This Proves

- The IVS backend is operational and allocating stages
- Canvas capture and WebRTC publishing work end-to-end
- The same approach works for any canvas-based game (Phaser, Three.js, Unity WebGL, etc.)

### Troubleshooting

| Symptom | Fix |
|---------|-----|
| Preflight check "Backend reachable" fails | Check network, VPN, or try `curl https://substream-sdk-production.up.railway.app/api/health` |
| "IVS SDK not loaded" | Disable ad-blocker, check console for CDN errors |
| Opened via `file://` | Must serve over HTTP -- use `python3 -m http.server` |

---

## Level 1: API Demo (No AWS Required)

This demonstrates the backend API is functional.

### Step 1: Start Backend

```bash
cd IVSBackend
pnpm install
pnpm db:generate

# Set up database (local PostgreSQL or Supabase)
# Edit .env with DATABASE_URL

pnpm db:migrate
pnpm dev
```

### Step 2: Seed Test Data

```bash
npx tsx scripts/seed-test-data.ts
```

### Step 3: Test Health Endpoint

```bash
curl http://localhost:3000/api/health
```

Expected:
```json
{
  "status": "ok",
  "features": {
    "database": true,
    "awsIvs": false,
    ...
  }
}
```

### Step 4: Test Ingest Endpoint (Will Fail Without AWS)

```bash
curl -X POST http://localhost:3000/api/streams/children/test-child-id/ingest \
  -H "Authorization: Bearer test-user-id" \
  -H "Content-Type: application/json"
```

This will return an error about missing AWS credentials - **that's expected!** It proves the API routing and auth work.

---

## Level 2: Full IVS Pipeline Demo (With AWS)

### Prerequisites
- AWS account with IVS access
- S3 bucket for recordings
- IVS recording configuration
- IVS playback key pair

### Step 1: Configure AWS Credentials

Edit `IVSBackend/.env`:
```bash
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=your-key
AWS_SECRET_ACCESS_KEY=your-secret
IVS_RECORDING_CONFIG_ARN=arn:aws:ivs:...
IVS_PLAYBACK_KEY_PAIR_ID=arn:aws:ivs:...
IVS_PLAYBACK_PRIVATE_KEY="-----BEGIN EC PRIVATE KEY-----\n..."
```

### Step 2: Get Ingest Credentials

```bash
curl -X POST http://localhost:3000/api/streams/children/test-child-id/ingest \
  -H "Authorization: Bearer test-user-id" \
  -H "Content-Type: application/json"
```

Response:
```json
{
  "channelArn": "arn:aws:ivs:us-east-1:...",
  "ingest": {
    "protocol": "rtmps",
    "endpoint": "rtmps://xxx.global-contribute.live-video.net:443/app/",
    "streamKey": "sk_us-east-1_..."
  },
  "recommendedEncoderConfig": {...}
}
```

### Step 3: Create Session

```bash
curl -X POST http://localhost:3000/api/streams/children/test-child-id/sessions \
  -H "Authorization: Bearer test-user-id" \
  -H "Content-Type: application/json"
```

### Step 4: Stream with OBS or FFmpeg

**OBS:**
1. Settings → Stream
2. Service: Custom
3. Server: `rtmps://xxx.global-contribute.live-video.net:443/app/`
4. Stream Key: `sk_us-east-1_...` (from step 2)
5. Start Streaming

**FFmpeg:**
```bash
ENDPOINT="rtmps://xxx.global-contribute.live-video.net:443/app/"
KEY="sk_us-east-1_..."

ffmpeg -f lavfi -i testsrc=size=1280x720:rate=30 \
       -f lavfi -i sine=frequency=1000:sample_rate=44100 \
       -c:v libx264 -preset veryfast -b:v 3500k \
       -g 60 -keyint_min 60 \
       -c:a aac -b:a 128k \
       -f flv "${ENDPOINT}${KEY}"
```

### Step 5: Get Playback URL

```bash
curl http://localhost:3000/api/streams/children/test-child-id/playback \
  -H "Authorization: Bearer test-parent-user-id"
```

### Step 6: Watch Stream

Use the returned `playback.url` and `playback.token` with an IVS player:

```html
<script src="https://player.live-video.net/1.12.0/amazon-ivs-player.min.js"></script>
<video id="video-player" playsinline controls></video>
<script>
  const player = IVSPlayer.create();
  player.attachHTMLVideoElement(document.getElementById('video-player'));
  player.load('PLAYBACK_URL?token=TOKEN');
  player.play();
</script>
```

### Step 7: End Session

```bash
curl -X DELETE http://localhost:3000/api/streams/sessions/SESSION_ID \
  -H "Authorization: Bearer test-user-id"
```

---

## Level 3: Unity Integration Demo

### Prerequisites
- All Level 2 prerequisites
- Unity 2023+
- (Optional) Native FFmpeg library built

### Step 1: Open Unity Project

```
Open: UnityProject/
```

### Step 2: Configure IVSStreamControl

1. Find/add GameObject with `IVSStreamControl`
2. In Inspector:
   - **Backend URL**: `http://localhost:3000`
   - **Child ID**: `test-child-id`
   - **Auth Token**: `test-user-id`

### Step 3: Run

1. Press Play in Unity
2. Press `U` key to start streaming
3. Check Console for:

**With Stub (no native library):**
```
[IVS] Got ingest config: arn:aws:ivs:...
[RTMP STUB] Would connect to: rtmps://xxx.../app/sk_...
[IVS] Status: LIVE (stub mode)
```

**With Native Library:**
```
[IVS] Got ingest config: arn:aws:ivs:...
[IVS] RTMP connected
[IVS] Streaming at 1280x720@30fps
```

---

## Quick Demo Script

For a quick demo without setup, run this in the browser console on the backend home page:

```javascript
// Demo API calls (backend must be running)
const BASE = 'http://localhost:3000';

// 1. Health check
fetch(`${BASE}/api/health`).then(r => r.json()).then(console.log);

// 2. Attempt ingest (will show AWS not configured)
fetch(`${BASE}/api/streams/children/test-child-id/ingest`, {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer test-user-id',
    'Content-Type': 'application/json'
  }
}).then(r => r.json()).then(console.log);
```

---

## What to Tell Stakeholders

### "Does IVS work?"

> "Yes, the IVS streaming backend is fully implemented. API routes for ingest credentials, session management, playback authorization, and VOD listing are all functional. To demo actual streaming, we need AWS IVS credentials configured. The Unity integration is ready and falls back to a stub when the native FFmpeg library isn't available."

### "When should we use IVS vs WebRTC?"

> "Use IVS when automatic recording and reliability matter more than latency (2-5 second delay). Use WebRTC when you need sub-second latency for real-time interaction. Both are available in different branches."

### "What's left to do?"

> 1. Configure AWS credentials (Jesse has these)
> 2. Build native FFmpeg library for production (optional - can demo with OBS)
> 3. Integration testing with real Unity builds
