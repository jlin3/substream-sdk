# Migration Guide: WebRTC → IVS (RTMPS)

This guide explains how to migrate from the WebRTC-based `RenderStreamControl.cs` to the new IVS-based `IVSStreamControl.cs`.

## Why Migrate?

| Feature | WebRTC (Old) | IVS (New) |
|---------|--------------|-----------|
| **Latency** | <500ms | 2-5 seconds |
| **Recording** | Client-side, manual | Automatic to S3 |
| **Scaling** | Self-managed servers | AWS-managed |
| **Reliability** | Depends on TURN servers | Enterprise-grade |
| **VOD** | Manual upload | Automatic |
| **Cost** | TURN servers expensive | Pay-per-use |

**Recommendation**: Use IVS for production deployments where automatic recording and reliability matter more than sub-second latency.

---

## Quick Start

### 1. Replace the Script

In your Unity scene:
1. Remove `RenderStreamControl` component
2. Add `IVSStreamControl` component
3. Configure the new settings (see below)

### 2. Update Backend URL

```
Old: https://your-backend.up.railway.app (WebSocket signaling)
New: http://localhost:3000 (or your IVS backend URL)
```

### 3. Set Child ID

The new system uses a `childId` to identify the streamer:
```csharp
ivsStreamControl.SetChildId("child-profile-001");
ivsStreamControl.SetAuthToken("user-jwt-token");
```

---

## Component Comparison

### Old: RenderStreamControl
```csharp
public string backendUrl = "https://...";  // WebSocket signaling
public string authToken = "";
public int streamBitrate = 8000;
public int streamFrameRate = 60;
```

### New: IVSStreamControl  
```csharp
public string backendUrl = "http://localhost:3000";  // REST API
public string childId = "child-profile-001";         // NEW
public string authToken = "";
public int streamWidth = 1280;
public int streamHeight = 720;
public int streamBitrate = 3500;
public int streamFrameRate = 30;
public int keyframeInterval = 2;                      // IVS requirement
```

---

## RTMP Library Required

Unity doesn't have built-in RTMP support. You need a native library.

### Recommended Options

#### 1. AVPro Live Camera (Commercial) - **Recommended for Quest**
- $200 one-time purchase
- Native Quest support
- Hardware encoding
- Professional support
- [Asset Store Link](https://assetstore.unity.com/packages/tools/video/avpro-live-camera-3683)

```csharp
// Example integration
public class AVProRTMPPublisher : IRTMPPublisher
{
    private AVProLiveCamera camera;
    
    public void Connect(string url)
    {
        camera.SetOutputPath(url);
        camera.StartCapture();
    }
    
    public void StartPublishing()
    {
        camera.StartEncoding();
    }
}
```

#### 2. FFmpeg Native Plugin (Free, Complex)
- Requires native Android/iOS compilation
- More control, more work
- [FFmpeg Unity Tutorial](https://github.com/FFmpeg/FFmpeg)

#### 3. Custom Native Plugin
- Write Android/iOS native code
- Use platform RTMP libraries
- Most complex but most flexible

### Testing Without Native Library

You can test the backend using OBS or FFmpeg:

```bash
# The API returns RTMPS credentials
curl -X POST http://localhost:3000/api/streams/children/child-profile-001/ingest \
  -H "Authorization: Bearer child-profile-001"

# Use credentials with FFmpeg
ffmpeg -f lavfi -i testsrc=size=1280x720:rate=30 \
  -c:v libx264 -g 60 -c:a aac \
  -f flv "rtmps://ENDPOINT/STREAMKEY"
```

---

## API Changes

### Old API (WebRTC Backend)

```
PUT /signaling                    # Create session
POST /signaling/offer             # Send SDP offer
POST /signaling/answer            # Send SDP answer
POST /signaling/candidate         # Send ICE candidate
DELETE /signaling                 # Delete session
```

### New API (IVS Backend)

```
POST /api/streams/children/:childId/ingest     # Get RTMPS credentials
POST /api/streams/children/:childId/sessions   # Create session
DELETE /api/streams/sessions/:sessionId        # End session
POST /api/streams/sessions/:sessionId/heartbeat # Health check
GET /api/streams/children/:childId/playback    # Get playback URL (for viewers)
GET /api/streams/children/:childId/vods        # List recordings
```

---

## Backend Changes

### What You Can Remove

The following backend code is no longer needed:
- `src/signaling.ts` - WebRTC signaling routes
- `src/websocket.ts` - WebSocket server
- `src/class/offer.ts`, `answer.ts`, `candidate.ts` - SDP handling
- TURN server configuration

### What You Keep

- Authentication (`src/middleware/auth.ts`)
- Session tracking (now via new API)
- Recording storage (now automatic via IVS)

### New Backend

The new IVS backend is located at:
```
/Users/jesselinson/Substream/substream/
├── src/app/api/streams/     # New API routes
├── src/lib/streaming/       # IVS service layer
└── docs/STREAMING_SETUP.md  # Setup guide
```

---

## Step-by-Step Migration

### Step 1: Set Up New Backend

```bash
cd /Users/jesselinson/Substream/substream

# Already done: PostgreSQL, Prisma, AWS IVS setup
# Just start the server:
pnpm dev
```

### Step 2: Update Unity Project

1. Copy `IVSStreamControl.cs` to your project
2. Add to your streaming GameObject
3. Configure:
   - `Backend URL`: `http://localhost:3000` (or production URL)
   - `Child ID`: From your user system
   - `Auth Token`: JWT from your auth system

### Step 3: Implement RTMP Publisher

Replace the `StubRTMPPublisher` with your chosen library:

```csharp
// In IVSStreamControl.cs, InitializeRTMPPublisher()
private void InitializeRTMPPublisher()
{
    // Replace this line:
    rtmpPublisher = new StubRTMPPublisher();
    
    // With your implementation:
    rtmpPublisher = new AVProRTMPPublisher(); // Or your library
}
```

### Step 4: Test

1. Start backend: `pnpm dev`
2. Open http://localhost:3000/streaming-demo
3. Get credentials on "Streamer" tab
4. Test with OBS/FFmpeg first
5. Then test Unity integration

### Step 5: Update Viewer

Replace WebRTC viewer with IVS Player:

```typescript
// React/Web viewer
import { IVSPlayer } from '@/components/streaming';

<IVSPlayer
  playbackUrl={playbackData.url}
  playbackToken={playbackData.token}
  autoplay
/>
```

---

## Encoder Settings for IVS

IVS has specific requirements:

| Setting | Value | Notes |
|---------|-------|-------|
| **Codec** | H.264 | Required |
| **Profile** | Main or High | Baseline not recommended |
| **Resolution** | 1280x720 | Or lower for Quest |
| **Framerate** | 30 fps | 60 optional |
| **Bitrate** | 3500 kbps | 1500-8500 range |
| **Keyframe** | 2 seconds | **Required by IVS** |

---

## Troubleshooting

### "Failed to get streaming credentials"
- Check backend is running
- Verify childId exists in database
- Check authToken is valid

### "RTMP connection failed"
- Verify stream key is correct
- Check network allows RTMPS (port 443)
- Try with OBS first to isolate issue

### "No video in player"
- Check IVS channel is receiving video (AWS Console)
- Verify playback token is valid
- Check browser console for errors

### "Recording not appearing"
- Wait 1-2 minutes after stream ends
- Check S3 bucket for files
- Verify recording configuration in IVS

---

## Files Changed

### Unity Project
- **Added**: `Assets/Scripts/IVSStreamControl.cs`
- **Deprecated**: `Assets/Scripts/RenderStreamControl.cs` (keep for reference)

### Backend (New Repo)
- Location: `/Users/jesselinson/Substream/substream/`
- API: `src/app/api/streams/`
- Services: `src/lib/streaming/`
- Components: `src/components/streaming/`

---

## Questions?

Test the demo page at http://localhost:3000/streaming-demo to see the full flow working.

