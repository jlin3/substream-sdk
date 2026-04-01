---
sidebar_position: 3
title: "Quick Start: Unity"
---

# Quick Start: Unity

Add live streaming to a Unity game (Windows, macOS, Quest 2/3/Pro).

## 1. Import the SDK

Copy the streaming scripts into your Unity project:

```
UnityProject/Assets/Scripts/  →  YourProject/Assets/Scripts/
```

Install the Unity WebRTC package via Package Manager:
- Open **Window > Package Manager**
- Click **+** > **Add package by name**
- Enter: `com.unity.webrtc`

## 2. Add the Streaming Component

1. Add `IVSRealTimeStreamControl` to a GameObject in your scene
2. Configure in the Inspector:
   - **Backend URL**: `https://substream-sdk-production.up.railway.app`
   - **Streamer ID**: `demo-child-001`
   - **Auth Token**: `demo-token`

## 3. Start Streaming

```csharp
// Programmatically
streamControl.StartStreaming();

// Or use the built-in keyboard shortcut
// Press 'U' to toggle streaming on/off
```

## 4. Watch the Stream

Open the [dashboard](https://substream-sdk-production.up.railway.app/api/auth/demo-auto) or the [web viewer](https://github.com/jlin3/substream-sdk/tree/main/examples/web-viewer) to see your Unity game streaming live.

## Streaming Modes

| Mode | Component | Protocol | Latency | Platform |
|------|-----------|----------|---------|----------|
| **WebRTC** (recommended) | `IVSRealTimeStreamControl` | WebRTC | < 1 second | All platforms |
| **WHIP** | `WhipStreamControl` | WHIP/WebRTC | < 1 second | All platforms |
| **RTMPS** (legacy) | `IVSStreamControl` | RTMPS | 2-5 seconds | Requires native FFmpeg |

Use **WebRTC mode** — it uses Unity's built-in WebRTC package, works out of the box, and has the lowest latency.

## Platform Support

| Platform | Status |
|----------|--------|
| Windows (Editor) | Production |
| macOS (Editor) | Production |
| Quest 2/3/Pro | Production |
| iOS | Coming soon |
| Unity WebGL | Use `@substream/web-sdk` instead |

## Next Steps

- [SDK Streaming Guide](https://github.com/jlin3/substream-sdk/blob/main/SDK_STREAMING_GUIDE.md) — Full Unity integration guide
- [Concepts: Streams](./concepts/streams) — How streams work
- [Concepts: Recordings](./concepts/recordings) — Automatic cloud recording
