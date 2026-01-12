# Migration Guide: WebRTC to IVS (RTMPS)

This guide explains how to migrate from the WebRTC-based `RenderStreamControl.cs` to the new IVS-based `IVSStreamControl.cs`.

## What's Already Done (No Action Needed)

The following components are **already implemented** in this branch:

### Unity Components

| Component | Status | Location |
|-----------|--------|----------|
| `IVSStreamControl.cs` | Complete | `UnityProject/Assets/Scripts/` |
| `NativeFFmpegBridge.cs` | Complete | `UnityProject/Assets/Scripts/Substream/` |
| `FFmpegRTMPPublisher.cs` | Complete | `UnityProject/Assets/Scripts/Substream/` |
| Stub RTMP publisher | Complete | Built into `IVSStreamControl.cs` |
| Native plugin structure | Complete | `UnityProject/Plugins/` |

### Backend Components

| Component | Status | Location |
|-----------|--------|----------|
| IVS streaming API routes | Complete | `IVSBackend/src/app/api/streams/` |
| Stream service layer | Complete | `IVSBackend/src/lib/streaming/` |
| Database schema (Prisma) | Complete | `IVSBackend/prisma/schema.prisma` |
| Playback authorization | Complete | `IVSBackend/src/lib/streaming/playback-auth.ts` |
| Stream key encryption | Complete | `IVSBackend/src/lib/streaming/encryption.ts` |

## What You Need to Do

### Required Steps

1. **Set up environment variables** - Copy `IVSBackend/env.example.txt` to `.env` and fill in credentials
2. **Run database migrations** - `cd IVSBackend && pnpm db:migrate`
3. **Start the backend** - `cd IVSBackend && pnpm dev`

### Optional Steps

- **Build native FFmpeg library** - Only needed for actual RTMPS streaming (the stub works for testing)
- **Set up AWS IVS** - Only if self-hosting (otherwise use test credentials from project owner)

---

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

## RTMP Library Status

The native FFmpeg library enables real RTMP streaming. Here's the current status:

### Stub Publisher (Default)

When native library is not available, the stub publisher:
- Logs all API calls correctly
- Shows RTMPS credentials in console
- Does NOT actually stream video
- Useful for testing API integration

### Native Publisher

When native library is built and available:
- Real RTMPS streaming to IVS
- Hardware encoding where available
- Full frame transmission

### Building Native Library

See `UnityProject/Plugins/README.md` for build instructions.

**Alternative for Testing**: Use OBS or FFmpeg directly with the credentials from the API.

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

### What You Can Remove (WebRTC Backend)

The following backend code is no longer needed for IVS:
- `WebappBackend/src/signaling.ts` - WebRTC signaling routes
- `WebappBackend/src/websocket.ts` - WebSocket server
- `WebappBackend/src/class/offer.ts`, `answer.ts`, `candidate.ts` - SDP handling
- TURN server configuration

### What You Keep

- Authentication patterns (adapt to your system)
- Session tracking concepts (now via IVS API)
- Recording storage concepts (now automatic via IVS)

### New Backend Location

The IVS backend is now included in this repository:

```
substream-sdk/
├── IVSBackend/           # NEW - IVS streaming backend
│   ├── src/
│   │   ├── app/api/streams/
│   │   └── lib/streaming/
│   ├── prisma/
│   └── package.json
├── WebappBackend/        # OLD - WebRTC backend (legacy)
└── UnityProject/
```

---

## Step-by-Step Migration

### Step 1: Set Up New Backend

```bash
cd IVSBackend

# Install dependencies
pnpm install

# Create .env from template
cp env.example.txt .env

# Edit .env with credentials (from project owner or your AWS setup)
nano .env

# Generate Prisma client
pnpm db:generate

# Run database migrations
pnpm db:migrate

# Start the dev server
pnpm dev
```

### Step 2: Update Unity Project

1. Open Unity project in `UnityProject/`
2. Remove `RenderStreamControl` component (if present)
3. Add `IVSStreamControl` component to your streaming GameObject
4. Configure:
   - **Backend URL**: `http://localhost:3000`
   - **Child ID**: From your user system
   - **Auth Token**: JWT from your auth system

### Step 3: Test API Integration

1. Start backend: `pnpm dev`
2. Press Play in Unity
3. Press `U` to toggle streaming
4. Check console for API responses

### Step 4: Update Viewer (Web)

Replace WebRTC viewer with IVS Player:

```typescript
// React/Web viewer
import { IVSPlayer } from 'amazon-ivs-player';

const player = IVSPlayer.create();
player.attachHTMLVideoElement(videoElement);
player.load(playbackUrl);
player.play();
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
- **Added**: `Assets/Scripts/Substream/NativeFFmpegBridge.cs`
- **Added**: `Assets/Scripts/Substream/FFmpegRTMPPublisher.cs`
- **Deprecated**: `Assets/Scripts/RenderStreamControl.cs` (keep for reference)

### Backend
- **Added**: `IVSBackend/` - Complete IVS backend
- **Legacy**: `WebappBackend/` - WebRTC backend (still works if needed)

---

## Questions?

See the main setup guide at `IVS_BACKEND_SETUP.md` for complete instructions.
