# IVS Streaming System - Testing Guide

This guide walks through testing the complete IVS streaming system end-to-end.

## Prerequisites

1. **Backend Running**: The IVS backend must be running at `http://localhost:3000`
2. **Database Setup**: PostgreSQL with test data seeded
3. **AWS Configured**: IVS channels and S3 bucket configured (or use test credentials)

## Quick Start Testing

### 1. Start the Backend

```bash
# Navigate to the IVS backend
cd IVSBackend

# Install dependencies (first time only)
pnpm install

# Ensure .env is configured
# Copy env.example.txt to .env and fill in credentials

# Generate Prisma client (first time only)
pnpm db:generate

# Run migrations (first time only)
pnpm db:migrate

# Start the server
pnpm dev
```

Verify: http://localhost:3000/api/health

### 2. Test API Endpoints

**PowerShell:**
```powershell
# Get ingest credentials
$headers = @{ "Authorization" = "Bearer test-user-id"; "Content-Type" = "application/json" }
Invoke-RestMethod -Uri "http://localhost:3000/api/streams/children/test-child-id/ingest" -Method POST -Headers $headers

# Create streaming session
Invoke-RestMethod -Uri "http://localhost:3000/api/streams/children/test-child-id/sessions" -Method POST -Headers $headers
```

**Bash/curl:**
```bash
# Health check
curl http://localhost:3000/api/health

# Get ingest credentials
curl -X POST http://localhost:3000/api/streams/children/test-child-id/ingest \
  -H "Authorization: Bearer test-user-id" \
  -H "Content-Type: application/json"

# Create streaming session
curl -X POST http://localhost:3000/api/streams/children/test-child-id/sessions \
  -H "Authorization: Bearer test-user-id" \
  -H "Content-Type: application/json"
```

### 3. Test with OBS/FFmpeg (Without Unity)

If you want to verify the IVS pipeline works before Unity:

```bash
# Get credentials first from API
# Then use the returned endpoint and stream key

# Stream test pattern with FFmpeg
INGEST_URL="rtmps://xxxxxx.global-contribute.live-video.net:443/app/"
STREAM_KEY="sk_us-east-1_xxxxxxxxxxxx"

ffmpeg -f lavfi -i testsrc=size=1280x720:rate=30 \
       -f lavfi -i sine=frequency=1000:sample_rate=44100 \
       -c:v libx264 -preset veryfast -b:v 3500k -maxrate 3500k -bufsize 7000k \
       -g 60 -keyint_min 60 \
       -c:a aac -b:a 128k -ar 44100 \
       -f flv "${INGEST_URL}${STREAM_KEY}"
```

### 4. View Stream

Get playback URL via API:
```bash
curl http://localhost:3000/api/streams/children/test-child-id/playback \
  -H "Authorization: Bearer test-parent-id"
```

Use the returned URL and token with an IVS player.

## Unity Testing

### Testing in Unity Editor

1. **Open Project**
   ```
   Open: UnityProject/
   ```

2. **Check Console for Plugin Load**
   Look for:
   - `[IVS] Native FFmpeg library available - using real RTMP publisher`
   - Or: `[IVS] Native FFmpeg library not available - falling back to stub`

3. **Configure IVSStreamControl**
   - Select GameObject with `IVSStreamControl` component
   - Set `Backend URL`: `http://localhost:3000`
   - Set `Child ID`: `test-child-id` (or your test user)

4. **Start Streaming**
   - Press Play in Unity
   - Press `U` key to toggle streaming
   - Check Console for connection messages

5. **Expected Console Output (Stub Mode)**
   ```
   [IVS] Status: Fetching ingest credentials...
   [IVS] Got ingest config: arn:aws:ivs:...
   [IVS] Status: Creating session...
   [IVS] Session created: <uuid>
   [IVS] Status: Connecting to IVS...
   [RTMP STUB] Would connect to: rtmps://xxx.global-contribute.live-video.net:443/app/sk_...
   [RTMP STUB] This is a stub! Native library not available.
   [IVS] Status: LIVE
   ```

### Testing Native Library Integration

If the native library isn't loading, test in isolation:

```csharp
// Add this test script to a GameObject
using UnityEngine;
using Substream.Streaming;

public class FFmpegTest : MonoBehaviour
{
    void Start()
    {
        Debug.Log($"FFmpeg Available: {NativeFFmpegBridge.IsAvailable()}");
        
        if (NativeFFmpegBridge.IsAvailable())
        {
            var state = NativeFFmpegBridge.GetState();
            Debug.Log($"FFmpeg State: {state}");
        }
    }
}
```

## Platform-Specific Testing

### Quest VR Testing

1. **Build APK**
   - File > Build Settings
   - Platform: Android
   - Texture Compression: ASTC
   - Build

2. **Install on Quest**
   ```bash
   adb install -r SubstreamSDK.apk
   ```

3. **Run and Test**
   - Launch app on Quest
   - Look around - camera follows head
   - Press controller button mapped to streaming toggle
   - Check backend logs for session creation

4. **Verify Stream**
   - Get playback URL from API
   - Open in browser with IVS player
   - Should see Quest VR view streaming

### Windows Standalone Testing

1. **Build**
   - File > Build Settings
   - Platform: Windows x64
   - Build

2. **Ensure DLLs Present**
   Copy to build folder alongside exe:
   - `ffmpeg_rtmp.dll`
   - `avcodec-*.dll`
   - `avformat-*.dll`
   - `avutil-*.dll`
   - `swscale-*.dll`
   - `swresample-*.dll`

3. **Run and Test**

## Troubleshooting

### "Failed to get streaming credentials"

- Check backend is running (`pnpm dev` in `IVSBackend/`)
- Verify API endpoint is accessible: `curl http://localhost:3000/api/health`
- Check childId matches database (or use test ID)

### "Failed to create session"

- Check database connection (verify DATABASE_URL in .env)
- Verify child profile exists in database
- Check AWS IVS channel is created

### "FFmpeg connect failed"

- Verify RTMP URL format (should start with `rtmps://`)
- Check network connectivity
- Ensure firewall allows outbound port 443

### Stream not appearing in viewer

- Wait 5-10 seconds (IVS latency)
- Check IVS console for incoming stream
- Verify playback token generation
- Check browser console for player errors

### Native library not loading

- Verify library is in correct `UnityProject/Plugins/` subfolder
- Check Unity import settings (.meta file)
- On macOS: Check Security & Privacy for blocked library
- Restart Unity after adding plugins

## Monitoring

### Backend Logs

```bash
# Watch Next.js logs
cd IVSBackend
pnpm dev
# Logs appear in terminal
```

### IVS Console

https://console.aws.amazon.com/ivs/

- View active channels
- Check stream health
- See recorded videos in S3

### Database

```bash
# Open Prisma Studio
cd IVSBackend
pnpm db:studio

# Or connect directly
psql $DATABASE_URL

# Check sessions
SELECT * FROM "ChildStreamSession" ORDER BY "startedAt" DESC LIMIT 5;
```

## End-to-End Test Checklist

- [ ] Backend running and healthy (`/api/health` returns OK)
- [ ] Database connected with test data
- [ ] IVS channel created in AWS (or using test credentials)
- [ ] API returns ingest credentials
- [ ] Unity loads (stub or native) RTMP publisher
- [ ] Unity creates streaming session via API
- [ ] RTMP connection established (or stub logs correctly)
- [ ] Frames being sent (check stats in Inspector)
- [ ] Stream visible in IVS console (if real streaming)
- [ ] Playback works in browser viewer
- [ ] Session ends cleanly via API
- [ ] Recording saved to S3 (if enabled)

## Test Data Setup

If you need to create test users in the database:

```sql
-- Create test user
INSERT INTO "User" (id, email, role, "displayName", "kidVerified", "createdAt", "updatedAt")
VALUES ('test-user-id', 'test@example.com', 'CHILD', 'Test Child', true, NOW(), NOW());

-- Create child profile
INSERT INTO "ChildProfile" (id, "userId", "streamingEnabled", "maxStreamDuration", "createdAt", "updatedAt")
VALUES ('test-child-id', 'test-user-id', true, 120, NOW(), NOW());-- Create parent user
INSERT INTO "User" (id, email, role, "displayName", "createdAt", "updatedAt")
VALUES ('test-parent-id', 'parent@example.com', 'PARENT', 'Test Parent', NOW(), NOW());-- Create parent profile
INSERT INTO "ParentProfile" (id, "userId", "notificationsEnabled", "createdAt", "updatedAt")
VALUES ('test-parent-profile-id', 'test-parent-id', true, NOW(), NOW());-- Link parent to child
INSERT INTO "ParentChildRelation" (id, "parentId", "childId", "canWatch", "canViewVods", "createdAt", "updatedAt")
VALUES ('test-relation-id', 'test-parent-profile-id', 'test-child-id', true, true, NOW(), NOW());
```
