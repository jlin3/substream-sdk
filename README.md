# Substream SDK

[![npm version](https://img.shields.io/npm/v/@substream/web-sdk.svg)](https://www.npmjs.com/package/@substream/web-sdk)
[![CI](https://github.com/jlin3/substream-sdk/actions/workflows/ci.yml/badge.svg)](https://github.com/jlin3/substream-sdk/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

**Add live streaming to any game with 5 lines of code.**

Stream gameplay from web canvas or Unity games via WebRTC with sub-second latency. Automatic cloud recording, AI-generated highlights, and a full analytics dashboard.

---

## Live Demo

Try it right now — no setup required:

| | |
|---|---|
| **Landing Page** | [substream-sdk-production.up.railway.app](https://substream-sdk-production.up.railway.app) |
| **Interactive Demo** | [/demo](https://substream-sdk-production.up.railway.app/demo) — play Breakout and stream it live |
| **Dashboard** | [/api/auth/demo-auto](https://substream-sdk-production.up.railway.app/api/auth/demo-auto) — auto-login to explore streams, recordings, and AI highlights |

---

## Quick Start: Web Games

```bash
npm install @substream/web-sdk amazon-ivs-web-broadcast
```

```js
import Substream from '@substream/web-sdk';

const session = await Substream.startStream({
  canvasElement: document.querySelector('canvas'),
  backendUrl: 'https://your-api.com',
  authToken: 'your-token',
});

console.log('Live! Viewer URL:', session.viewerUrl);
```

Works with **Phaser, Three.js, PixiJS, Unity WebGL, Cocos, Construct**, and any `<canvas>` game.

For a zero-build-step version using script tags, see [examples/web-game-demo/](examples/web-game-demo/).

---

## Quick Start: iOS

Install via Swift Package Manager:

```
https://github.com/jlin3/substream-sdk
```

Select the `SubstreamSDK` product, then:

```swift
import SubstreamSDK

let session = try await Substream.startStream(
    .init(
        backendUrl: URL(string: "https://your-api.com")!,
        authToken: "sk_live_…",
        streamerId: "player-456",
        capture: .metalView(self.gameView)   // or .spriteKit, .sceneKit, .replayKit, .broadcastExtension
    )
)

print("Live!", session.viewerUrl)
```

Works with **Metal, MTKView, SpriteKit, SceneKit, UIKit**, in-app **ReplayKit**, and system-wide capture via a **Broadcast Upload Extension**.

Full guide: [`packages/ios-sdk/README.md`](packages/ios-sdk/README.md) · Example app: [`packages/ios-sdk/Example/`](packages/ios-sdk/Example/)

---

## Quick Start: Unity

1. Copy SDK scripts to your project:
```
UnityProject/Assets/Scripts/  →  YourProject/Assets/Scripts/
```

2. Add `IVSRealTimeStreamControl` to a GameObject and configure:
   - **Backend URL**: Your Substream API endpoint
   - **Streamer ID**: User ID from your auth system
   - **Auth Token**: Auth token from your auth system

3. Start streaming:
```csharp
streamControl.StartStreaming();  // or press 'U' to toggle
```

Full guide: [SDK_STREAMING_GUIDE.md](SDK_STREAMING_GUIDE.md)

---

## What You Get

| Feature | Description |
|---------|-------------|
| **Canvas Streaming** | Capture any HTML5 canvas or Unity game and stream via WebRTC |
| **Sub-Second Latency** | IVS Real-Time stages deliver < 500ms glass-to-glass |
| **Cloud Recording** | Every stream automatically recorded to S3 |
| **AI Highlights** | Analyze recordings and generate highlight reels with best moments |
| **Dashboard** | Browse streams, watch live, view recordings, manage highlights |
| **Webhooks** | Get notified on stream.started, stream.stopped, viewer.joined events |
| **Multi-Platform** | Web canvas, Unity (Windows, macOS, Quest), and more |

---

## Project Structure

```
substream-sdk/
├── packages/web-sdk/           # @substream/web-sdk — TypeScript SDK
├── packages/ios-sdk/           # SubstreamSDK — native iOS SDK (Swift, SwiftPM + CocoaPods)
│   ├── Sources/SubstreamSDK/   # Core SDK + capture sources (Metal/SpriteKit/SceneKit/ReplayKit)
│   ├── Tests/                  # Unit tests
│   └── Example/                # SubstreamDemo app + Broadcast Upload Extension
├── examples/
│   ├── web-game-demo/          # Standalone web game streaming demo
│   └── web-viewer/             # Stream viewer page
├── UnityProject/               # Unity SDK components
│   └── Assets/Scripts/         # IVSRealTimeStreamControl, WhipStreamControl, etc.
├── IVSBackend/                 # Next.js API server + dashboard
│   ├── src/app/api/            # Streaming, auth, webhook APIs
│   ├── src/app/dashboard/      # Analytics dashboard
│   └── prisma/                 # Database schema
├── highlight-service/          # AI highlight generation (Python/FastAPI)
└── SDK_STREAMING_GUIDE.md      # Full integration guide
```

---

## For SDK Users (Game Developers)

You do **not** need to run any backend code. Just integrate the SDK and point it at a hosted Substream API.

- [SDK_STREAMING_GUIDE.md](SDK_STREAMING_GUIDE.md) — Complete integration guide
- [examples/web-game-demo/](examples/web-game-demo/) — Working web demo with source
- [examples/web-viewer/](examples/web-viewer/) — Viewer page for watching streams

## For Operators (Hosting the Infrastructure)

- [IVS_BACKEND_SETUP.md](IVS_BACKEND_SETUP.md) — Deploy the IVS backend
- [DEMO_GUIDE.md](DEMO_GUIDE.md) — Run the full demo end-to-end

---

## Demo Credentials

For quick testing against the hosted API:

| Setting | Value |
|---------|-------|
| **API** | `https://substream-sdk-production.up.railway.app` |
| **Child ID** | `demo-child-001` |
| **Auth Token** | `demo-token` |
| **Viewer Token** | `demo-viewer-token` |

---

## Platform Support

| Platform | SDK | Status |
|----------|-----|--------|
| Web (any canvas) | `@substream/web-sdk` | Production |
| iOS Native (Metal/SpriteKit/SceneKit/UIKit/ReplayKit) | `SubstreamSDK` (SwiftPM / CocoaPods) | Production |
| Unity Windows/macOS | `IVSRealTimeStreamControl` | Production |
| Unity Quest 2/3/Pro | `IVSRealTimeStreamControl` | Production |
| Unity WebGL | `@substream/web-sdk` | Production |
| Unity iOS | `IVSRealTimeStreamControl` via `SubstreamSDK` native plugin | On roadmap |
| Android Native | `SubstreamSDK-Android` | On roadmap |

---

## Built With

- [Amazon IVS](https://aws.amazon.com/ivs/) — Real-time streaming infrastructure
- [Next.js](https://nextjs.org) — API server and dashboard
- [Prisma](https://prisma.io) — Database ORM
- [Google Cloud Video Intelligence](https://cloud.google.com/video-intelligence) — Highlight analysis
