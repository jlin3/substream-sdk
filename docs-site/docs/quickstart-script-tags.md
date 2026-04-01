---
sidebar_position: 4
title: "Quick Start: Script Tags"
---

# Quick Start: Script Tags

The fastest way to add streaming — just two script tags. No npm, no bundler, no build step.

## 1. Add the Scripts

```html
<script src="https://web-broadcast.live-video.net/1.32.0/amazon-ivs-web-broadcast.js"></script>
<script src="substream.js"></script>
```

Copy `substream.js` from [examples/web-game-demo/](https://github.com/jlin3/substream-sdk/tree/main/examples/web-game-demo).

## 2. Start Streaming

```html
<canvas id="game-canvas" width="1280" height="720"></canvas>

<script>
  async function goLive() {
    const session = await Substream.startStream({
      canvas: document.getElementById('game-canvas'),
      backendUrl: 'https://substream-sdk-production.up.railway.app',
      childId: 'demo-child-001',
      authToken: 'demo-token',
      title: 'My Game Stream',
    });

    console.log('Viewer URL:', session.viewerUrl);
  }
</script>
```

## 3. Stop Streaming

```javascript
session.stop();
```

## With Audio

To capture game audio alongside video:

```javascript
Substream.captureAudio(); // Call before game audio initializes

const session = await Substream.startStream({
  canvas: document.getElementById('game-canvas'),
  backendUrl: 'https://substream-sdk-production.up.railway.app',
  childId: 'demo-child-001',
  authToken: 'demo-token',
  audio: true,
});
```

## Complete Example

See the full working demo at [examples/web-game-demo/](https://github.com/jlin3/substream-sdk/tree/main/examples/web-game-demo) — a Breakout game with preflight checks, event log, and streaming controls.

## Next Steps

- [Quick Start: Web Games](./quickstart-web) — npm-based integration with TypeScript support
- [SDK Reference](./sdk-reference) — Full API documentation
