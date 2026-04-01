# WHIP Streaming Testing Guide

This guide explains how to test the new WHIP (WebRTC) streaming feature that enables sub-second latency streaming from Unity to web viewers.

## Architecture Overview

```
┌─────────────────┐         ┌─────────────────┐         ┌─────────────────┐
│   Unity Game    │ ──WHIP──│  Railway Backend │──IVS───│  Parent Browser │
│  (Publisher)    │         │  (Coordinator)   │         │   (Viewer)      │
└─────────────────┘         └─────────────────┘         └─────────────────┘
        │                           │                           │
        │  POST /api/streams/whip   │                           │
        │  ──────────────────────>  │                           │
        │  <── publish token ────   │                           │
        │                           │                           │
        │  WebRTC to IVS            │                           │
        │  ════════════════════════════════════════>            │
        │                           │                           │
        │                           │  POST /api/streams/:id/viewer
        │                           │  <────────────────────────│
        │                           │  ── subscribe token ────> │
        │                           │                           │
        │                           │        WebRTC from IVS    │
        │                           │  <════════════════════════│
```

## Live Backend

**Production URL:** `https://substream-sdk-production.up.railway.app`

### Verify Backend Health

```bash
curl https://substream-sdk-production.up.railway.app/api/health | jq .
```

Expected: `"ivsRealTime": true`

---

## Testing Options

### Option 1: Test via curl (API only)

#### 1. Get a Publish Token (simulates Unity)

```bash
curl -X POST https://substream-sdk-production.up.railway.app/api/streams/whip \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer demo-token" \
  -d '{
    "childId": "demo-child-001",
    "sdpOffer": "v=0\r\no=- 0 0 IN IP4 127.0.0.1\r\ns=-\r\nt=0 0\r\nm=video 9 UDP/TLS/RTP/SAVPF 96\r\nc=IN IP4 0.0.0.0\r\na=mid:0\r\na=sendonly"
  }' | jq .
```

**Response includes:**
- `streamId` - Unique stream identifier
- `publishToken` - JWT for WebRTC publishing
- `whipUrl` - IVS WHIP endpoint
- `mediaConstraints` - Required codec settings (H.264 baseline, 720p max)

#### 2. Get a Viewer Token (simulates Parent)

```bash
# Replace {streamId} with the streamId from step 1
curl -X POST https://substream-sdk-production.up.railway.app/api/streams/{streamId}/viewer \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer demo-viewer-token" \
  -d '{"parentUserId": "parent-001", "childId": "demo-child-001"}' | jq .
```

**Response includes:**
- `subscribeToken` - JWT for WebRTC viewing
- `stageArn` - IVS stage identifier
- `viewerConfig` - SDK URLs

---

### Option 2: Test with Unity (Full E2E)

#### Prerequisites
1. Unity 2021.3+ with WebRTC package: `com.unity.webrtc@3.0.0-pre.7`
2. Clone the repo and open `UnityProject/`

#### Steps

1. **Add WhipStreamControl to your scene:**
   - Create empty GameObject
   - Add Component → `Substream.Streaming.WhipStreamControl`

2. **Configure in Inspector:**
   | Setting | Value |
   |---------|-------|
   | Backend URL | `https://substream-sdk-production.up.railway.app` |
   | Child ID | `demo-child-001` |
   | Auth Token | `demo-token` |

3. **Start Streaming:**
   - Press Play in Unity Editor
   - Press `U` key to start streaming
   - Check Console for stream ID

4. **View the Stream:**
   - Open browser: `https://substream-sdk-production.up.railway.app/viewer/{streamId}`
   - Video should appear with <500ms latency

---

### Option 3: Test Web Viewer Only

If Unity isn't set up, you can still test the viewer page:

```
https://substream-sdk-production.up.railway.app/viewer/test-stream-123
```

The page will load and show "Connecting to stream..." (will error since no publisher is streaming, but confirms the page works).

---

## Code Examples

### Unity: Start Streaming Programmatically

```csharp
using Substream.Streaming;

public class MyGame : MonoBehaviour
{
    public WhipStreamControl streamControl;
    
    public void StartGameStream()
    {
        // Configure
        streamControl.backendUrl = "https://substream-sdk-production.up.railway.app";
        streamControl.childId = "my-child-id";
        streamControl.authToken = "my-auth-token";
        
        // Start streaming
        streamControl.StartStreaming();
    }
    
    public void StopGameStream()
    {
        streamControl.StopStreaming();
    }
    
    public string GetViewerUrl()
    {
        return $"{streamControl.backendUrl}/viewer/{streamControl.GetCurrentStreamId()}";
    }
}
```

### Web: Embed Viewer in Your App

```html
<!-- Option 1: Use built-in viewer page -->
<iframe 
  src="https://substream-sdk-production.up.railway.app/viewer/{streamId}?parentId=xxx" 
  width="100%" 
  height="480"
  allow="autoplay"
></iframe>

<!-- Option 2: Get token and use IVS SDK directly -->
<script>
async function watchStream(streamId, authToken) {
  const response = await fetch(
    `https://substream-sdk-production.up.railway.app/api/streams/${streamId}/viewer`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`
      },
      body: JSON.stringify({ parentUserId: 'parent-001' })
    }
  );
  
  const { subscribeToken, stageArn } = await response.json();
  
  // Use subscribeToken with IVS Real-Time Web SDK
  // See: https://docs.aws.amazon.com/ivs/latest/RealTimeUserGuide/web-subscribe.html
}
</script>
```

---

## API Reference

### POST /api/streams/whip

Creates a WHIP streaming session for Unity publishers.

**Headers:**
- `Authorization: Bearer {auth-token}`
- `Content-Type: application/json`

**Body:**
```json
{
  "childId": "string",
  "sdpOffer": "string (SDP)"
}
```

**Response:**
```json
{
  "streamId": "uuid",
  "stageArn": "arn:aws:ivs:...",
  "whipUrl": "https://global.whip.live-video.net",
  "publishToken": "JWT",
  "participantId": "string",
  "expiresAt": "ISO8601",
  "mediaConstraints": {
    "videoCodec": "H.264",
    "videoProfile": "baseline",
    "maxWidth": 1280,
    "maxHeight": 720,
    "maxFramerate": 30,
    "maxBitrateBps": 2500000
  }
}
```

### POST /api/streams/{streamId}/viewer

Gets a subscribe token for parent viewers.

**Headers:**
- `Authorization: Bearer {viewer-token}`
- `Content-Type: application/json`

**Body:**
```json
{
  "parentUserId": "string",
  "childId": "string (optional)"
}
```

**Response:**
```json
{
  "streamId": "uuid",
  "stageArn": "arn:aws:ivs:...",
  "subscribeToken": "JWT",
  "participantId": "string",
  "expiresAt": "ISO8601"
}
```

---

## Troubleshooting

### "ivsRealTime: false" in health check
- IVS stages not configured. Contact backend admin to run `pnpm ivs:setup`.

### Unity: "WHIP connection failed"
- Check backend URL is correct
- Verify auth token is valid (`demo-token` for testing)
- Check Unity Console for detailed error

### Viewer: "Unable to Join Stream"
- Stream may have ended
- Check streamId is correct
- Verify viewer token is valid (`demo-viewer-token` for testing)

### High latency (>1 second)
- Check network connection
- Ensure H.264 hardware encoding is available
- Reduce resolution/bitrate in WhipStreamControl settings

---

## Demo Credentials

| Credential | Value | Use |
|------------|-------|-----|
| Backend URL | `https://substream-sdk-production.up.railway.app` | All requests |
| Publisher Token | `demo-token` | Unity streaming |
| Viewer Token | `demo-viewer-token` | Parent viewing |
| Child ID | `demo-child-001` | Test user |

---

## Files Reference

| File | Description |
|------|-------------|
| `UnityProject/Assets/Scripts/Streaming/WhipStreamControl.cs` | Main Unity streaming component |
| `UnityProject/Assets/Scripts/Streaming/WhipClient.cs` | WHIP protocol implementation |
| `IVSBackend/src/app/api/streams/whip/route.ts` | Backend WHIP endpoint |
| `IVSBackend/src/app/api/streams/[streamId]/viewer/route.ts` | Viewer token endpoint |
| `IVSBackend/src/app/viewer/[streamId]/page.tsx` | Web viewer page |
| `SDK_STREAMING_GUIDE.md` | Full SDK integration guide |
