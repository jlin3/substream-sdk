# IVS Streaming System - Testing Guide

This guide walks through testing the complete IVS streaming system end-to-end.

## Prerequisites

1. **Backend Running**: The Next.js backend must be running at `http://localhost:3000`
2. **Database Setup**: PostgreSQL with test data seeded
3. **AWS Configured**: IVS channels and S3 bucket configured

## Quick Start Testing

### 1. Verify Backend is Running

```bash
cd /Users/jesselinson/Substream/substream
pnpm dev
```

Check: http://localhost:3000/streaming-demo

### 2. Test API Endpoints

```bash
# Get ingest credentials
curl -X POST http://localhost:3000/api/streams/children/child-profile-001/ingest \
  -H "Content-Type: application/json"

# Create streaming session
curl -X POST http://localhost:3000/api/streams/children/child-profile-001/sessions \
  -H "Content-Type: application/json"
```

### 3. Test with OBS/FFmpeg (Without Unity)

If you want to verify the IVS pipeline works before Unity:

```bash
# Get credentials first
INGEST_URL="rtmps://xxxxxx.global-contribute.live-video.net:443/app/"
STREAM_KEY="sk_us-east-1_xxxxxxxxxxxx"

# Stream test pattern with FFmpeg
ffmpeg -f lavfi -i testsrc=size=1280x720:rate=30 \
       -f lavfi -i sine=frequency=1000:sample_rate=44100 \
       -c:v libx264 -preset veryfast -b:v 3500k -maxrate 3500k -bufsize 7000k \
       -g 60 -keyint_min 60 \
       -c:a aac -b:a 128k -ar 44100 \
       -f flv "${INGEST_URL}${STREAM_KEY}"
```

### 4. View Stream

Open the streaming demo page in a browser:
- http://localhost:3000/streaming-demo
- Click "Get Playback" 
- Stream should appear in the IVS player

## Unity Testing

### Testing in Unity Editor (macOS)

1. **Open Project**
   ```
   Open: /Users/jesselinson/substream-sdk/UnityProject
   ```

2. **Check Console for Plugin Load**
   Look for:
   - ✅ `[IVS] Native FFmpeg library available - using real RTMP publisher`
   - ❌ `[IVS] Native FFmpeg library not available - falling back to stub`

3. **Configure IVSStreamControl**
   - Select GameObject with `IVSStreamControl` component
   - Set `Backend URL`: `http://localhost:3000`
   - Set `Child ID`: `child-profile-001`

4. **Start Streaming**
   - Press Play in Unity
   - Press `U` key to toggle streaming
   - Check Console for connection messages

5. **Verify in Browser**
   - Open streaming demo page
   - Click "Get Playback" for the child
   - Should see Unity camera feed (2-5 second delay)

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
   - Open streaming demo on PC/phone
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

- Check backend is running
- Verify API endpoint is accessible
- Check childId matches database

### "Failed to create session"

- Check database connection
- Verify child profile exists
- Check AWS IVS channel is created

### "FFmpeg connect failed"

- Verify RTMP URL format
- Check network connectivity
- Ensure firewall allows outbound 443

### Stream not appearing in viewer

- Wait 5-10 seconds (IVS latency)
- Check IVS console for incoming stream
- Verify playback token generation
- Check browser console for player errors

### Native library not loading

- Verify library is in correct Plugins folder
- Check Unity import settings (.meta file)
- On macOS: Check Security & Privacy for blocked library
- Restart Unity after adding plugins

## Monitoring

### IVS Console
https://console.aws.amazon.com/ivs/

- View active channels
- Check stream health
- See recorded videos in S3

### Backend Logs

```bash
# Watch Next.js logs
pnpm dev
# Logs appear in terminal
```

### Database

```bash
# Connect to PostgreSQL
psql substream

# Check sessions
SELECT * FROM "ChildStreamSession" ORDER BY "startedAt" DESC LIMIT 5;

# Check channels
SELECT * FROM "ChildStreamChannel";
```

## End-to-End Test Checklist

- [ ] Backend running and healthy
- [ ] Database connected with test data
- [ ] IVS channel created in AWS
- [ ] API returns ingest credentials
- [ ] Unity loads native FFmpeg library
- [ ] Unity creates streaming session
- [ ] RTMP connection established
- [ ] Frames being sent (check stats)
- [ ] Stream visible in IVS console
- [ ] Playback works in browser viewer
- [ ] Session ends cleanly
- [ ] Recording saved to S3 (if enabled)

