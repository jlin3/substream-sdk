---
sidebar_position: 2
title: "Quick Start: Web Games"
---

# Quick Start: Web Games

Stream any HTML5 canvas game in under 5 minutes. Works with Phaser, Three.js, PixiJS, Unity WebGL, Cocos, Construct, and any engine that renders to `<canvas>`.

## 1. Install

```bash
npm install @substream/web-sdk amazon-ivs-web-broadcast
```

## 2. Start Streaming

```javascript
import { SubstreamSDK } from '@substream/web-sdk';

// Optional: capture game audio (call before game engine initializes)
SubstreamSDK.captureAudio();

// Start streaming
const session = await SubstreamSDK.startStream({
  canvasElement: document.querySelector('canvas'),
  backendUrl: 'https://substream-sdk-production.up.railway.app',
  streamerId: 'demo-child-001',
  authToken: 'demo-token',
  title: 'My Game Stream',
  onLive: ({ streamId, viewerUrl }) => {
    console.log('Live!', viewerUrl);
  },
});
```

## 3. Stop Streaming

```javascript
await session.stop();
```

## 4. Watch the Stream

Open the [dashboard](https://substream-sdk-production.up.railway.app/api/auth/demo-auto) and navigate to **Live Streams** to see your stream appear in real-time.

## Configuration Options

| Option | Type | Required | Description |
|--------|------|----------|-------------|
| `canvasElement` | `HTMLCanvasElement` | Yes | The canvas to capture |
| `backendUrl` | `string` | Yes | Substream API URL |
| `streamerId` | `string` | Yes | Unique player/streamer ID |
| `authToken` | `string` | Yes | API key or JWT token |
| `orgId` | `string` | No | Organization ID for dashboard |
| `streamerName` | `string` | No | Display name |
| `title` | `string` | No | Stream title |
| `fps` | `number` | No | Frame rate (default: 30) |
| `audio` | `boolean` | No | Include audio (default: true) |
| `onLive` | `function` | No | Called when stream goes live |
| `onError` | `function` | No | Called on error |
| `onStopped` | `function` | No | Called when stream stops |

## Audio Capture

Canvas streaming only captures video by default. To include game audio, call `SubstreamSDK.captureAudio()` **before** your game engine creates its `AudioContext`:

```javascript
SubstreamSDK.captureAudio(); // Must be called first!
// Then initialize your game engine
```

This monkey-patches `AudioNode.connect` to tee audio into a `MediaStream` alongside the video. Audio still plays through speakers normally.

## Next Steps

- [SDK Reference](./sdk-reference) — Full API documentation
- [Concepts: Streams](./concepts/streams) — How streams work
- [API Reference](./api-reference) — REST API endpoints
