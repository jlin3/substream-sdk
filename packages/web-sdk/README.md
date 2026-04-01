# @substream/web-sdk

Stream any HTML5 canvas game to viewers via WebRTC. Works with Phaser, Three.js, PixiJS, Unity WebGL, Cocos, Construct, and any engine that renders to `<canvas>`.

## Install

```bash
npm install @substream/web-sdk amazon-ivs-web-broadcast
```

## Usage

```js
import { SubstreamSDK } from '@substream/web-sdk';

// Optional: capture game audio (call before game engine initializes)
SubstreamSDK.captureAudio();

// Start streaming
const session = await SubstreamSDK.startStream({
  canvasElement: document.querySelector('canvas'),
  backendUrl: 'https://your-api.com',
  streamerId: 'player-123',
  authToken: 'your-token',
  title: 'My Game Stream',
  onLive: ({ streamId, viewerUrl }) => {
    console.log('Live!', viewerUrl);
  },
});

// Stop streaming
await session.stop();
```

## Configuration

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

```js
SubstreamSDK.captureAudio(); // Must be called first
// Then initialize your game engine
```

This monkey-patches `AudioNode.connect` to tee audio into a `MediaStream` alongside the video. Audio still plays through speakers normally.

## Demo

Test with our hosted demo API:

```js
const session = await SubstreamSDK.startStream({
  canvasElement: document.querySelector('canvas'),
  backendUrl: 'https://substream-sdk-production.up.railway.app',
  streamerId: 'demo-child-001',
  authToken: 'demo-token',
});
```

## Script Tag Usage

For zero-build-step usage, see [examples/web-game-demo/](../../examples/web-game-demo/) which uses `substream.js` directly via `<script>` tags.

## License

MIT
