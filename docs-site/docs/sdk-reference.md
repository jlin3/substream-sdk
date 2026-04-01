---
sidebar_position: 7
title: SDK Reference
---

# SDK Reference

## Installation

```bash
npm install @substream/web-sdk amazon-ivs-web-broadcast
```

## `SubstreamSDK.startStream(config)`

Start streaming a canvas element. Returns a `SubstreamSession`.

### Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `canvasElement` | `HTMLCanvasElement` | Yes | The canvas to capture |
| `backendUrl` | `string` | Yes | Substream API URL |
| `streamerId` | `string` | Yes | Unique player/streamer ID |
| `authToken` | `string` | Yes | API key or JWT |
| `orgId` | `string` | No | Organization ID |
| `streamerName` | `string` | No | Display name |
| `title` | `string` | No | Stream title |
| `fps` | `number` | No | Frame rate (default: 30) |
| `audio` | `boolean` | No | Include audio (default: true) |
| `onLive` | `(info) => void` | No | Called when live with `{ streamId, viewerUrl }` |
| `onError` | `(error) => void` | No | Called on error |
| `onStopped` | `() => void` | No | Called when stopped |
| `onReconnecting` | `() => void` | No | Called when reconnecting |

### Returns: `SubstreamSession`

| Property | Type | Description |
|----------|------|-------------|
| `streamId` | `string` | Unique stream ID |
| `viewerUrl` | `string` | URL for viewers to watch |
| `isLive` | `boolean` | Whether the stream is currently live |
| `stop()` | `() => Promise<void>` | Stop streaming |

### Example

```javascript
const session = await SubstreamSDK.startStream({
  canvasElement: document.querySelector('canvas'),
  backendUrl: 'https://your-api.com',
  streamerId: 'player-123',
  authToken: 'sk_live_xxx',
  title: 'Epic Game Session',
  onLive: ({ viewerUrl }) => {
    showViewerLink(viewerUrl);
  },
  onError: (err) => {
    console.error('Stream error:', err);
  },
});

// Later...
await session.stop();
```

## `SubstreamSDK.captureAudio()`

Enable automatic audio capture by monkey-patching `AudioNode.connect`.

**Must be called before the game engine creates its `AudioContext`** (before Unity loader, before Phaser, etc.).

Audio still plays through speakers normally.

```javascript
import { SubstreamSDK } from '@substream/web-sdk';

// Call first, before game initialization
SubstreamSDK.captureAudio();

// Then initialize your game
const game = new Phaser.Game(config);
```

### How It Works

1. Patches `AudioNode.prototype.connect`
2. When audio is routed to `AudioDestinationNode` (speakers), it also tees into a `MediaStreamDestination`
3. Those audio tracks are included in the stream alongside video
4. No audible difference — audio plays normally

## TypeScript

The SDK is written in TypeScript and ships with full type definitions:

```typescript
import { SubstreamSDK, SubstreamConfig, SubstreamSession } from '@substream/web-sdk';

const config: SubstreamConfig = {
  canvasElement: document.querySelector('canvas')!,
  backendUrl: 'https://your-api.com',
  streamerId: 'player-123',
  authToken: 'sk_live_xxx',
};

const session: SubstreamSession = await SubstreamSDK.startStream(config);
```
