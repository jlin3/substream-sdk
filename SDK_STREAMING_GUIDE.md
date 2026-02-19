# Streaming SDK Integration Guide

Add live streaming from your Unity game or HTML5 web game to a web viewer.

```
┌─────────────────┐                    ┌─────────────────┐
│   Your Unity    │  ──── Stream ────> │   Web Viewer    │
│     Game        │                    │   (Browser)     │
└─────────────────┘                    └─────────────────┘
        │                                      │
        └──────────────────────────────────────┘
                        ↓
                Managed by Substream
               (No setup required!)
```

---

## Streaming Modes

The SDK supports two streaming modes:

| Mode | Component | Protocol | Latency | Platform Support |
|------|-----------|----------|---------|------------------|
| **WebRTC** (Recommended) | `IVSRealTimeStreamControl` | WebRTC | <1 second | All platforms |
| **RTMPS** (Legacy) | `IVSStreamControl` | RTMPS | 2-5 seconds | Requires native libs |

> **Use WebRTC mode** - It uses Unity's built-in WebRTC package, works out of the box, and has lower latency!

---

## Quick Demo (Try It Now!)

Want to test streaming immediately? Use our demo credentials:

| Setting | Value |
|---------|-------|
| **Demo API** | `https://substream-sdk-production.up.railway.app` |
| **Demo Child ID** | `demo-child-001` |
| **Streaming Token** | `demo-token` (for Unity - starts the stream) |
| **Viewer Token** | `demo-viewer-token` (for web viewer - watches the stream) |
| **Demo Viewer** | Open `examples/web-viewer/index.html` in your browser |

> **Note**: Demo credentials allow you to test streaming immediately. The streaming token is for the Unity child, the viewer token is for the parent watching. For production use, integrate with k-ID authentication.

### Quick Test Steps (WebRTC Mode - Recommended)

1. Import the SDK into Unity (see Step 1 below)
2. Add `IVSRealTimeStreamControl` component to a GameObject
3. Set these values in the Inspector:
   - **Backend URL**: `https://substream-sdk-production.up.railway.app`
   - **Child ID**: `demo-child-001`
   - **Auth Token**: `demo-token`
4. Press Play in Unity
5. Press `U` to start streaming
6. Open `examples/web-viewer/index.html` in your browser to watch your stream!

---

## Prerequisites

- **Unity 2021.3+** (2023+ recommended)
- **API credentials** - Use demo credentials above, or get production credentials from your provider

---

## Step 1: Import the SDK

Copy these folders from the SDK into your Unity project:

```
UnityProject/Assets/Scripts/     →  YourProject/Assets/Scripts/
```

**Required files for WebRTC mode (Recommended):**
- `Scripts/IVSRealTimeStreamControl.cs` - WebRTC streaming component

**Required files for RTMPS mode (Legacy):**
- `Scripts/IVSStreamControl.cs` - RTMPS streaming component
- `Scripts/Streaming/FFmpegRTMPPublisher.cs` - Video encoding
- `Scripts/Streaming/NativeFFmpegBridge.cs` - Native library interface
- `Plugins/` - Native streaming libraries (per platform)

**Also install Unity WebRTC package** (for WebRTC mode):
1. Open Window → Package Manager
2. Click + → Add package from git URL
3. Enter: `com.unity.webrtc@3.0.0-pre.7`
4. Click Add

---

## Step 2: Add Streaming to Your Scene

### WebRTC Mode (Recommended)

1. **Create a GameObject** for streaming (or use an existing one)

2. **Add the `IVSRealTimeStreamControl` component**
   - In Unity: `Add Component → IVSRealTimeStreamControl`

3. **Configure in the Inspector:**

| Setting | Value | Description |
|---------|-------|-------------|
| **Backend URL** | `https://substream-sdk-production.up.railway.app` | API endpoint (use demo URL or your own) |
| **Child ID** | `demo-child-001` | Use demo ID or your user's ID |
| **Auth Token** | `demo-token` | Use demo token or your user's auth token |

**Quality Settings** (optional):
- Stream Width: `1280` (default)
- Stream Height: `720` (default)
- Target Bitrate: `3.5` Mbps (default)
- Frame Rate: `30` fps (default)

### RTMPS Mode (Legacy)

1. Add the `IVSStreamControl` component instead
2. Same configuration as above
3. Requires native FFmpeg libraries in `Plugins/`

---

## Step 3: Control Streaming from Code

### Basic Usage (WebRTC Mode)

```csharp
using UnityEngine;

public class GameStreamManager : MonoBehaviour
{
    // Use IVSRealTimeStreamControl for WebRTC (recommended)
    public IVSRealTimeStreamControl streamControl;
    
    // Call this when player wants to start streaming
    public void StartStream()
    {
        streamControl.StartStreaming();
    }
    
    // Call this when player wants to stop streaming
    public void StopStream()
    {
        streamControl.StopStreaming();
    }
    
    // Check if currently streaming
    public bool IsLive()
    {
        return streamControl.IsStreaming;
    }
    
    // Get WebRTC connection state
    public string GetConnectionState()
    {
        return streamControl.GetConnectionState();
    }
}
```

### Setting Credentials at Runtime

```csharp
public class AuthManager : MonoBehaviour
{
    public IVSRealTimeStreamControl streamControl;
    
    // Call after user logs in
    public void OnUserAuthenticated(string userId, string authToken)
    {
        streamControl.SetChildId(userId);
        streamControl.SetAuthToken(authToken);
    }
}
```

### Handling Events

```csharp
public class StreamEventHandler : MonoBehaviour
{
    public IVSRealTimeStreamControl streamControl;
    
    void Start()
    {
        // Subscribe to streaming events
        streamControl.OnStartStreaming.AddListener(OnStreamStarted);
        streamControl.OnStopStreaming.AddListener(OnStreamStopped);
        streamControl.OnError.AddListener(OnStreamError);
    }
    
    void OnStreamStarted()
    {
        Debug.Log("Stream is live!");
        // Update UI, show "LIVE" indicator, etc.
    }
    
    void OnStreamStopped()
    {
        Debug.Log("Stream ended");
        // Update UI
    }
    
    void OnStreamError(string error)
    {
        Debug.LogError($"Stream error: {error}");
        // Show error to user
    }
}
```

### Keyboard Shortcut (Built-in)

By default, pressing `U` toggles streaming on/off. You can disable this by removing the `Update()` check in `IVSStreamControl.cs`.

---

## Viewing the Stream

Once streaming starts, viewers can watch via:

### Option A: k-ID Dashboard

1. Log into the k-ID parent dashboard
2. Navigate to **Live Streams**
3. Click **Watch** on the active stream

### Option B: Embed in Your Web App

Add the IVS player to any web page:

```html
<!DOCTYPE html>
<html>
<head>
    <title>Stream Viewer</title>
    <script src="https://player.live-video.net/1.24.0/amazon-ivs-player.min.js"></script>
    <style>
        #video-player {
            width: 100%;
            max-width: 1280px;
            aspect-ratio: 16/9;
            background: #000;
        }
        .status {
            padding: 10px;
            font-family: sans-serif;
        }
        .live { color: #e53935; font-weight: bold; }
        .offline { color: #666; }
    </style>
</head>
<body>
    <div class="status" id="status">Checking stream...</div>
    <video id="video-player" playsinline controls></video>
    
    <script>
        // Replace with your API endpoint and child ID
        const API_ENDPOINT = 'https://api.kid.com';
        const CHILD_ID = 'your-child-id';
        const AUTH_TOKEN = 'your-auth-token';
        
        async function loadStream() {
            const statusEl = document.getElementById('status');
            
            try {
                // Get playback URL from API
                const response = await fetch(
                    `${API_ENDPOINT}/api/streams/children/${CHILD_ID}/playback`,
                    { headers: { 'Authorization': `Bearer ${AUTH_TOKEN}` } }
                );
                
                const data = await response.json();
                
                if (!data.status?.isLive) {
                    statusEl.textContent = 'Stream is offline';
                    statusEl.className = 'status offline';
                    return;
                }
                
                statusEl.innerHTML = '🔴 LIVE';
                statusEl.className = 'status live';
                
                // Initialize IVS player
                if (IVSPlayer.isPlayerSupported) {
                    const player = IVSPlayer.create();
                    player.attachHTMLVideoElement(document.getElementById('video-player'));
                    
                    // Load with auth token if private channel
                    player.load(data.playback.url);
                    if (data.playback.token) {
                        player.setPlaybackToken(data.playback.token);
                    }
                    
                    player.play();
                } else {
                    statusEl.textContent = 'Browser not supported';
                }
            } catch (error) {
                statusEl.textContent = `Error: ${error.message}`;
                console.error('Failed to load stream:', error);
            }
        }
        
        loadStream();
        // Refresh status every 10 seconds
        setInterval(loadStream, 10000);
    </script>
</body>
</html>
```

### Option C: Use the Example Viewer

We provide a ready-to-use viewer in `examples/web-viewer/`:

```bash
cd examples/web-viewer
# Open index.html in your browser
# Enter your stream URL and watch!
```

---

## Testing Locally

### Quick Test (No Backend Required)

1. Add `IVSStreamControl` to your scene
2. Press Play in Unity Editor
3. Press `U` to start streaming
4. Check the Console for output:

```
[IVS] Stream camera ready: 1280x720
[IVS] RTMP publisher initialized (using stub - native library not available)
[IVS] Status: Fetching ingest credentials...
```

If you see "stub" messages, the SDK is working but needs the native library for actual streaming.

### Full Test (With Backend)

1. Get test credentials from k-ID
2. Configure `IVSStreamControl` with your credentials
3. Press Play → Press `U`
4. Open the web viewer to see your stream!

---

## API Reference

### IVSRealTimeStreamControl Properties (WebRTC - Recommended)

| Property | Type | Description |
|----------|------|-------------|
| `backendUrl` | string | API endpoint URL |
| `childId` | string | User identifier |
| `authToken` | string | Authentication token |
| `streamWidth` | int | Video width (default: 1280) |
| `streamHeight` | int | Video height (default: 720) |
| `targetBitrateMbps` | float | Bitrate in Mbps (default: 3.5) |
| `streamFrameRate` | int | FPS (default: 30) |
| `IsStreaming` | bool | True if currently streaming |

### IVSRealTimeStreamControl Methods

| Method | Description |
|--------|-------------|
| `StartStreaming()` | Begin WebRTC streaming |
| `StopStreaming()` | Stop streaming |
| `ToggleStreaming()` | Toggle streaming on/off |
| `SetAuthToken(string)` | Set auth token at runtime |
| `SetChildId(string)` | Set child ID at runtime |
| `GetConnectionState()` | Get WebRTC connection state |
| `GetCurrentSessionId()` | Get current session ID |

### IVSStreamControl Properties (RTMPS - Legacy)

| Property | Type | Description |
|----------|------|-------------|
| `backendUrl` | string | API endpoint URL |
| `childId` | string | User identifier |
| `authToken` | string | Authentication token |
| `streamWidth` | int | Video width (default: 1280) |
| `streamHeight` | int | Video height (default: 720) |
| `streamBitrate` | int | Bitrate in kbps (default: 3500) |
| `streamFrameRate` | int | FPS (default: 30) |
| `IsStreaming` | bool | True if currently streaming |

### Events (Both Components)

| Event | Description |
|-------|-------------|
| `OnStartStreaming` | Fired when streaming begins |
| `OnStopStreaming` | Fired when streaming ends |
| `OnError(string)` | Fired on error with message |

---

## Troubleshooting

### "Failed to get streaming credentials"

- ✅ Check `backendUrl` is correct
- ✅ Check `childId` exists in your user system
- ✅ Check `authToken` is valid

### WebRTC Connection Issues

**"Connection state: Failed" or "Disconnected"**
- ✅ Check internet connection
- ✅ Verify firewall allows WebRTC (UDP ports)
- ✅ Try a different network (corporate networks may block WebRTC)

**"Signaling not available"**
- This means the backend doesn't have IVS Real-Time configured yet
- Contact your backend administrator to run `pnpm ivs:setup`
- Or switch to HLS mode in the web viewer

### "RTMP publisher initialized (using stub)" (RTMPS Mode)

This means the native FFmpeg library is not available. For actual streaming:
- **Option 1**: Switch to WebRTC mode (recommended) - no native libs needed!
- **Option 2**: Install native libraries in `Plugins/` folder

### Stream not showing in viewer

- ✅ Wait 5-10 seconds for stream to propagate
- ✅ Check playback URL is correct
- ✅ Verify auth token for private channels
- ✅ Check browser console for errors
- ✅ In web viewer, try switching between "WebRTC" and "HLS" modes

### Low quality or stuttering

- Reduce `targetBitrateMbps` (try 2.0)
- Reduce `streamWidth`/`streamHeight`
- Check network connection
- Use wired connection if possible
- For WebRTC: Check WebRTC connection state in Unity console

---

## Platform Support

### Unity Native (this guide)

| Platform | Status | Notes |
|----------|--------|-------|
| Windows (Editor) | ✅ Supported | Full streaming |
| macOS (Editor) | ✅ Supported | Full streaming |
| Quest 2/3/Pro | ✅ Supported | Android ARM64 |
| iOS | 🔄 In Progress | Coming soon |
| Unity WebGL | ❌ | No native plugins -- use the Web SDK below |

### Web Games (HTML5 canvas)

Unity WebGL builds and other canvas-based games (Phaser, Three.js, PixiJS, Cocos,
Construct) can stream using the **Web SDK** path instead.

This uses `canvas.captureStream()` + the IVS Web Broadcast SDK -- no native plugins
needed, runs entirely in the browser.

See [examples/web-game-demo/](examples/web-game-demo/) for a complete working demo.

**Quickest path (no npm, no build step):** Add two script tags and call `Substream.startStream()`:

```html
<script src="https://web-broadcast.live-video.net/1.32.0/amazon-ivs-web-broadcast.js"></script>
<script src="substream.js"></script>
<script>
  const session = await Substream.startStream({
    canvas: document.getElementById('game-canvas'),
    backendUrl: 'https://substream-sdk-production.up.railway.app',
    childId: 'demo-child-001',
    authToken: 'demo-token',
  });
  console.log('Viewer URL:', session.viewerUrl);
</script>
```

Copy `substream.js` from `examples/web-game-demo/substream.js`.
For TypeScript projects, see [packages/web-sdk/](packages/web-sdk/).

---

## Webhooks

Register a webhook to receive stream lifecycle events:

```bash
curl -X POST https://substream-sdk-production.up.railway.app/api/webhooks \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://your-app.com/hooks/substream",
    "events": ["stream.started", "stream.stopped", "viewer.joined", "viewer.left"]
  }'
```

Events are delivered as POST requests with HMAC-SHA256 signed payloads:

| Event | Fired When |
|-------|-----------|
| `stream.started` | A game starts publishing |
| `stream.stopped` | A game stops publishing |
| `viewer.joined` | A parent connects to watch |
| `viewer.left` | A parent disconnects |

The `X-Substream-Signature` header contains a `sha256=...` HMAC you can verify
with the secret returned during registration.

---

## Need Help?

1. Check the [Troubleshooting](#troubleshooting) section
2. Review Unity Console logs (filter by "[IVS]")
3. For web game issues, check the Event Log panel in the demo
4. Contact k-ID support with your `childId` and error messages

---

## What's Next?

- **Custom UI**: Build your own streaming controls using the events and methods
- **Analytics**: Use `GetStreamStats()` to show viewers stream health
- **VOD Playback**: Recorded streams are automatically available for replay
- **Web Games**: Use the Web SDK to stream canvas games from the browser

