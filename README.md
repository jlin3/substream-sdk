# Substream SDK - Production VR Streaming

**Production-ready Unity streaming for VR applications** with automatic recording, notifications, and enterprise-grade infrastructure.

Stream high-quality VR gameplay (1080p @ 30fps) from Quest headsets to web browsers.

## Streaming Approaches

This SDK supports **two streaming approaches**:

| Feature | WebRTC (main branch) | IVS (feature/ivs-streaming) |
|---------|---------------------|---------------------------|
| **Latency** | < 500ms | 2-5 seconds |
| **Recording** | Client-side | Automatic to S3 |
| **Scaling** | Self-managed TURN | AWS-managed |
| **Cost** | TURN servers expensive | Pay-per-use |
| **Best For** | Real-time interaction | VOD, reliability |

**Choose WebRTC** if you need sub-second latency for interactive features.

**Choose IVS** if you need automatic recording and enterprise reliability.

---

## Branch Structure

- **`main`** - WebRTC-based streaming (original approach)
- **`feature/ivs-streaming`** - AWS IVS-based streaming (recommended for production)

```bash
# For WebRTC streaming
git checkout main

# For IVS streaming (recommended)
git checkout feature/ivs-streaming
```

---

## Quick Start - IVS Streaming (Recommended)

### 1. Switch to IVS branch
```bash
git checkout feature/ivs-streaming
```

### 2. Start IVS Backend
```bash
cd IVSBackend
pnpm install

# Copy and configure environment
cp env.example.txt .env
# Edit .env with your credentials (see IVS_SETUP.md)

pnpm db:generate
pnpm db:migrate
pnpm dev
```

### 3. Test API
```bash
curl http://localhost:3000/api/health
```

### 4. Configure Unity
1. Open `UnityProject/` in Unity 2023+
2. Add `IVSStreamControl` component to a GameObject
3. Set Backend URL: `http://localhost:3000`
4. Press Play and press `U` to stream

See [IVS_SETUP.md](IVS_SETUP.md) for complete instructions.

---

## Quick Start - WebRTC Streaming

### 1. Start WebRTC Backend
```bash
cd WebappBackend
npm install
npm run dev
```

### 2. Open Receiver
Open `WebappBackend/client/public/receiver/index.html` in browser

### 3. Start Unity
1. Open `UnityProject/` in Unity 2023+
2. Open `Stream-test` scene
3. Press Play → Press `L` key
4. Video appears in browser!

---

## Features

- **High-Quality Streaming** - 1080p @ 30fps with adaptive bitrate
- **Automatic Recording** - Streams recorded to S3 (IVS) or client-side (WebRTC)
- **Parent Notifications** - Email alerts when streaming starts/ends
- **Multi-Viewer** - Concurrent viewers per stream
- **Secure** - JWT authentication for all connections
- **Quest VR Ready** - Optimized for Meta Quest headsets

---

## Project Structure

```
substream-sdk/
├── IVSBackend/              # IVS streaming backend (Next.js)
│   ├── src/
│   │   ├── app/api/streams/ # API routes
│   │   └── lib/streaming/   # IVS service layer
│   └── prisma/              # Database schema
│
├── WebappBackend/           # WebRTC streaming backend (Express)
│   ├── src/                 # Server code
│   ├── client/              # Web receiver
│   └── database/            # SQL schema
│
├── UnityProject/            # Unity VR project
│   ├── Assets/Scripts/
│   │   ├── IVSStreamControl.cs    # IVS streaming
│   │   └── RenderStreamControl.cs # WebRTC streaming
│   └── Plugins/             # Native libraries
│
└── docs/                    # Additional documentation
```

---

## Documentation

### IVS Streaming (feature/ivs-streaming branch)
- **[IVS_SETUP.md](IVS_SETUP.md)** - Complete IVS setup guide
- **[IVS_MIGRATION.md](IVS_MIGRATION.md)** - Migrating from WebRTC to IVS
- **[TESTING_GUIDE.md](TESTING_GUIDE.md)** - Testing the IVS system

### WebRTC Streaming (main branch)
- **[DEVELOPER_SETUP.md](DEVELOPER_SETUP.md)** - Full deployment guide
- **[SDK_INTEGRATION_GUIDE.md](SDK_INTEGRATION_GUIDE.md)** - Unity integration
- **[docs/SETUP_CHECKLIST.md](docs/SETUP_CHECKLIST.md)** - Deployment checklist

### General
- **[docs/PRODUCTION_DEPLOYMENT.md](docs/PRODUCTION_DEPLOYMENT.md)** - Production guide
- **[docs/WEB_APP_INTEGRATION.md](docs/WEB_APP_INTEGRATION.md)** - Frontend integration

---

## Architecture - IVS Streaming

```
┌─────────────────┐     RTMPS      ┌─────────────────┐
│   Unity VR      │ ─────────────> │  AWS IVS        │
│  (IVSStream-    │                │  Channel        │
│   Control.cs)   │                └────────┬────────┘
└─────────────────┘                         │
                                   Auto-Record to S3
                                            │
                                            v
┌─────────────────┐     HLS        ┌─────────────────┐
│  IVSBackend     │ <───────────── │  S3 Bucket      │
│  (API Server)   │                │  (VOD Storage)  │
└────────┬────────┘                └─────────────────┘
         │
         v
┌─────────────────┐
│  Web Viewer     │
│  (IVS Player)   │
└─────────────────┘
```

## Architecture - WebRTC Streaming

```
┌─────────────────┐
│   Unity VR      │
│  (RenderStream- │
│   Control.cs)   │
└────────┬────────┘
         │ WebSocket
         v
┌─────────────────┐      ┌─────────────────┐
│  WebappBackend  │─────>│  Supabase DB    │
│  (Signaling)    │      └─────────────────┘
└────────┬────────┘
         │ WebRTC
         v
┌─────────────────┐
│  Web Viewer     │
│  (Browser)      │
└─────────────────┘
```

---

## Cost Estimates

### IVS Streaming
- IVS Basic: ~$0.20/hour of streaming
- S3 Storage: ~$0.023/GB
- Total: $50-150/month for moderate usage

### WebRTC Streaming
- Railway: $20-50/month
- Twilio TURN: $100-200/month
- AWS S3: $20-50/month
- Total: $155-371/month

---

## Getting Help

1. Check the relevant setup guide:
   - IVS: [IVS_SETUP.md](IVS_SETUP.md)
   - WebRTC: [DEVELOPER_SETUP.md](DEVELOPER_SETUP.md)

2. Review troubleshooting sections in guides

3. Check backend logs:
   - IVS: `cd IVSBackend && pnpm dev`
   - WebRTC: `cd WebappBackend && npm run dev`

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
