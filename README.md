# Substream SDK - Production VR Streaming

**Production-ready Unity streaming for VR applications** with automatic recording, notifications, and enterprise-grade infrastructure.

Stream high-quality VR gameplay (1080p @ 30fps) from Quest headsets to web browsers.

---

## Who Is This For?

### Game Developers (SDK Users)

**Want to add streaming to your Unity game?** You're in the right place!

```
You integrate the SDK → Your users stream → Parents watch on web
```

**Start here:** [SDK_STREAMING_GUIDE.md](SDK_STREAMING_GUIDE.md)

You do NOT need to:
- Set up any backend servers
- Configure AWS or databases
- Run the `IVSBackend/` or `WebappBackend/` code

Just import the SDK, configure your API credentials, and start streaming!

---

### Service Operators (k-ID/Bezi)

**Hosting the streaming infrastructure?** See the backend setup guides.

| Backend | Guide | Description |
|---------|-------|-------------|
| **IVS** (Recommended) | [IVS_BACKEND_SETUP.md](IVS_BACKEND_SETUP.md) | AWS IVS + automatic recording |
| **WebRTC** | [DEVELOPER_SETUP.md](DEVELOPER_SETUP.md) | WebRTC signaling server |

The `IVSBackend/` and `WebappBackend/` directories contain server code that SDK users do NOT run.

---

## Try It Now (Demo)

Test streaming immediately with our live demo:

| Setting | Value |
|---------|-------|
| **Live API** | `https://substream-sdk-production.up.railway.app` |
| **Child ID** | `demo-child-001` |
| **Auth Token** | `demo-token` |

**[Full Demo Guide →](SDK_STREAMING_GUIDE.md#quick-demo-try-it-now)**

---

## Quick Start (Game Developers)

### 1. Import the SDK

Copy to your Unity project:
```
UnityProject/Assets/Scripts/  →  YourProject/Assets/Scripts/
UnityProject/Plugins/         →  YourProject/Plugins/
```

### 2. Add Streaming Component

1. Add `IVSStreamControl` component to a GameObject
2. Configure:
   - **Backend URL**: Your k-ID API endpoint
   - **Child ID**: User ID from your auth system
   - **Auth Token**: Auth token from your auth system

### 3. Start Streaming

```csharp
// Start streaming
streamControl.StartStreaming();

// Stop streaming
streamControl.StopStreaming();

// Or use keyboard shortcut: Press 'U' to toggle
```

### 4. Watch the Stream

Open the web viewer: `examples/web-viewer/index.html`

**Full guide:** [SDK_STREAMING_GUIDE.md](SDK_STREAMING_GUIDE.md)

---

## Streaming Approaches

This SDK supports **two streaming approaches**:

| Feature | IVS (Recommended) | WebRTC |
|---------|-------------------|--------|
| **Latency** | 2-5 seconds | < 500ms |
| **Recording** | Automatic to S3 | Client-side |
| **Scaling** | AWS-managed | Self-managed TURN |
| **Cost** | Pay-per-use | TURN servers expensive |
| **Best For** | VOD, reliability | Real-time interaction |

**Choose IVS** if you need automatic recording and enterprise reliability.

**Choose WebRTC** if you need sub-second latency for interactive features.

---

## Project Structure

```
substream-sdk/
├── SDK_STREAMING_GUIDE.md    # ← START HERE (Game Developers)
├── examples/
│   └── web-viewer/           # Simple stream viewer page
│
├── UnityProject/             # Unity SDK components
│   ├── Assets/Scripts/
│   │   ├── IVSStreamControl.cs    # IVS streaming (recommended)
│   │   └── RenderStreamControl.cs # WebRTC streaming
│   └── Plugins/              # Native libraries
│
├── IVSBackend/               # [OPERATORS ONLY] IVS backend server
│   ├── src/app/api/streams/  # API routes
│   ├── src/lib/streaming/    # IVS service layer
│   └── prisma/               # Database schema
│
├── WebappBackend/            # [OPERATORS ONLY] WebRTC backend server
│   ├── src/                  # Server code
│   ├── client/               # Web receiver
│   └── database/             # SQL schema
│
└── docs/                     # Additional documentation
```

---

## Documentation

### For Game Developers

| Guide | Description |
|-------|-------------|
| **[SDK_STREAMING_GUIDE.md](SDK_STREAMING_GUIDE.md)** | Complete SDK integration guide |
| **[examples/web-viewer/](examples/web-viewer/)** | Ready-to-use stream viewer |

### For Service Operators

| Guide | Description |
|-------|-------------|
| **[IVS_BACKEND_SETUP.md](IVS_BACKEND_SETUP.md)** | AWS IVS backend setup |
| **[IVS_MIGRATION.md](IVS_MIGRATION.md)** | Migrating from WebRTC to IVS |
| **[DEVELOPER_SETUP.md](DEVELOPER_SETUP.md)** | WebRTC backend setup |
| **[docs/PRODUCTION_DEPLOYMENT.md](docs/PRODUCTION_DEPLOYMENT.md)** | Production deployment |

---

## Features

- **High-Quality Streaming** - 1080p @ 30fps with adaptive bitrate
- **Automatic Recording** - Streams recorded to S3 (IVS) or client-side (WebRTC)
- **Parent Notifications** - Email alerts when streaming starts/ends
- **Multi-Viewer** - Concurrent viewers per stream
- **Secure** - JWT authentication for all connections
- **Quest VR Ready** - Optimized for Meta Quest headsets

---

## Architecture

```
┌─────────────────┐                      ┌─────────────────┐
│   Unity Game    │    ← SDK Users       │  Web Viewer     │
│  (Your App)     │    integrate this    │  (Parents)      │
└────────┬────────┘                      └────────┬────────┘
         │                                        │
         │ RTMPS                           HLS    │
         │                                        │
         v                                        v
┌─────────────────────────────────────────────────────────┐
│                   k-ID Hosted Service                   │
│                                                         │
│   ┌─────────────┐    ┌─────────────┐    ┌───────────┐  │
│   │  API Server │    │  AWS IVS    │    │    S3     │  │
│   │  (Backend)  │───>│  (Stream)   │───>│  (VODs)   │  │
│   └─────────────┘    └─────────────┘    └───────────┘  │
│                                                         │
│   ← Service Operators manage this                       │
└─────────────────────────────────────────────────────────┘
```

---

## Platform Support

| Platform | Status | Notes |
|----------|--------|-------|
| Windows (Editor) | ✅ | Full streaming |
| macOS (Editor) | ✅ | Full streaming |
| Quest 2/3/Pro | ✅ | Android ARM64 |
| iOS | 🔄 | Coming soon |
| WebGL | ❌ | No native plugins |

---

## Getting Help

1. **Game Developers**: Check [SDK_STREAMING_GUIDE.md](SDK_STREAMING_GUIDE.md)
2. **Service Operators**: Check [IVS_BACKEND_SETUP.md](IVS_BACKEND_SETUP.md)
3. Review Unity Console logs (filter by `[IVS]`)
4. Contact k-ID support

---

## License

[Your License Here]

---

## Credits

Built with:
- Unity Render Streaming
- AWS IVS
- Next.js / Express
- Prisma / Supabase
- FFmpeg
