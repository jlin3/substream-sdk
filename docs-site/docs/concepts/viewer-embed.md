---
sidebar_position: 2
title: Viewer & Website Embed
---

# Viewer & Website Embed

Every stream produces a **viewer URL** that renders the live IVS Real-Time
player. This is how gameplay reaches your company's own website — viewers watch
on your domain, not a third-party platform, with sub-second latency.

## Getting the viewer URL

`startStream()` returns it directly:

```js
const session = await Substream.startStream({
  canvasElement: document.querySelector('canvas'),
  backendUrl: 'https://your-api.com',
  streamerId: 'player-456',
  authToken: 'sk_live_...',
});

console.log(session.viewerUrl);
// → https://your-api.com/viewer/<streamId>
```

In Unity, call `streamControl.GetViewerUrl()` after the stream starts. In all
cases the URL points at `{backendUrl}/viewer/{streamId}`.

## Option A: Embed with an iframe (recommended)

The simplest integration — no player SDK required:

```html
<iframe
  src="https://your-api.com/viewer/STREAM_ID"
  allow="autoplay; fullscreen"
  style="width:100%; aspect-ratio:16/9; border:0; border-radius:12px"
></iframe>
```

For private streams, pass the viewer's auth token so the page can request a
scoped subscribe token:

```
https://your-api.com/viewer/STREAM_ID?auth=VIEWER_AUTH_TOKEN
```

## Option B: Build your own player

For full control over the UI, request a subscribe token and join the IVS
Real-Time stage yourself:

```js
const res = await fetch(`https://your-api.com/api/streams/${streamId}/viewer`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${VIEWER_AUTH_TOKEN}`,
  },
  body: JSON.stringify({ parentUserId: 'viewer-123' }),
});

const { subscribeToken, stageArn, participantId } = await res.json();
// Join the IVS Real-Time stage as a subscriber using subscribeToken.
```

## How it works

```
Game (publisher)  --WebRTC-->  IVS Real-Time stage  <--WebRTC--  Viewer (subscriber)
                                       ^
                          POST /api/streams/{id}/viewer
                              returns subscribeToken
```

The publisher and viewer join the same IVS Real-Time stage. The backend mints a
short-lived, scoped subscribe token for each viewer, so private streams stay
private. The hosted `/viewer/{streamId}` page is a working reference player.

## Where else the viewer appears

The same stage powers the dashboard's **Watch** view and the Twitch-style
**Browse** content feed, so live streams, recordings, and highlights all share
one playback path.
