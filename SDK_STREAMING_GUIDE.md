# Streaming SDK Integration Guide

Add live streaming from your Unity game to a web viewer in 3 simple steps.

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

### Quick Test Steps

1. Import the SDK into Unity (see Step 1 below)
2. Add `IVSStreamControl` component to a GameObject
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
UnityProject/Plugins/            →  YourProject/Plugins/
```

**Required files:**
- `Scripts/IVSStreamControl.cs` - Main streaming component
- `Scripts/FFmpegRTMPPublisher.cs` - Video encoding
- `Scripts/NativeFFmpegBridge.cs` - Native library interface
- `Plugins/` - Native streaming libraries (per platform)

---

## Step 2: Add Streaming to Your Scene

1. **Create a GameObject** for streaming (or use an existing one)

2. **Add the `IVSStreamControl` component**
   - In Unity: `Add Component → IVSStreamControl`

3. **Configure in the Inspector:**

| Setting | Value | Description |
|---------|-------|-------------|
| **Backend URL** | `https://api.kid.com` | Your k-ID API endpoint |
| **Child ID** | *(from your app)* | User ID from your authentication |
| **Auth Token** | *(from your app)* | Auth token from your authentication |

![Inspector Configuration](docs/images/ivs-inspector.png)

**Quality Settings** (optional):
- Stream Width: `1280` (default)
- Stream Height: `720` (default)
- Stream Bitrate: `3500` kbps (default)
- Frame Rate: `30` fps (default)

---

## Step 3: Control Streaming from Code

### Basic Usage

```csharp
using UnityEngine;

public class GameStreamManager : MonoBehaviour
{
    public IVSStreamControl streamControl;
    
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
}
```

### Setting Credentials at Runtime

```csharp
public class AuthManager : MonoBehaviour
{
    public IVSStreamControl streamControl;
    
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
    public IVSStreamControl streamControl;
    
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

### IVSStreamControl Properties

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

### IVSStreamControl Methods

| Method | Description |
|--------|-------------|
| `StartStreaming()` | Begin streaming |
| `StopStreaming()` | Stop streaming |
| `ToggleStreaming()` | Toggle streaming on/off |
| `SetAuthToken(string)` | Set auth token at runtime |
| `SetChildId(string)` | Set child ID at runtime |
| `GetStreamStats()` | Get (framesSent, droppedFrames, bitrateMbps) |

### Events

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

### "RTMP publisher initialized (using stub)"

This is normal in development! The stub allows testing without the native library. For actual streaming:
- Ensure native libraries are in `Plugins/` folder
- Check platform (Windows/macOS/Android/iOS)
- Restart Unity after adding plugins

### Stream not showing in viewer

- ✅ Wait 5-10 seconds for stream to propagate
- ✅ Check playback URL is correct
- ✅ Verify auth token for private channels
- ✅ Check browser console for errors

### Low quality or stuttering

- Reduce `streamBitrate` (try 2000 kbps)
- Reduce `streamWidth`/`streamHeight`
- Check network connection
- Use wired connection if possible

---

## Platform Support

| Platform | Status | Notes |
|----------|--------|-------|
| Windows (Editor) | ✅ Supported | Full streaming |
| macOS (Editor) | ✅ Supported | Full streaming |
| Quest 2/3/Pro | ✅ Supported | Android ARM64 |
| iOS | 🔄 In Progress | Coming soon |
| WebGL | ❌ Not Supported | No native plugins |

---

## Need Help?

1. Check the [Troubleshooting](#troubleshooting) section
2. Review Unity Console logs (filter by "[IVS]")
3. Contact k-ID support with your `childId` and error messages

---

## What's Next?

- **Custom UI**: Build your own streaming controls using the events and methods
- **Analytics**: Use `GetStreamStats()` to show viewers stream health
- **VOD Playback**: Recorded streams are automatically available for replay

