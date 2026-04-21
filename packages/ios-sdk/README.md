# SubstreamSDK for iOS

[![Swift](https://img.shields.io/badge/Swift-5.9%2B-orange)](https://swift.org)
[![Platform](https://img.shields.io/badge/platform-iOS%2014%2B-lightgrey)]()
[![SwiftPM](https://img.shields.io/badge/SwiftPM-compatible-brightgreen)]()
[![CocoaPods](https://img.shields.io/badge/CocoaPods-compatible-brightgreen)]()
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

**Add live streaming to any iOS game with 5 lines of Swift.**

Stream an `MTKView`, `SKView`, `SCNView`, `CAMetalLayer`, any `UIView`, or the full screen via ReplayKit — through the same Substream backend the web and Unity SDKs use. Sub-second latency via AWS IVS Real-Time, automatic cloud recording, AI highlights.

---

## Installation

### Swift Package Manager

In Xcode: **File → Add Packages…**

```
https://github.com/jlin3/substream-sdk
```

Select the `SubstreamSDK` library and point it at `packages/ios-sdk`.

Or add to your `Package.swift`:

```swift
.package(url: "https://github.com/jlin3/substream-sdk.git", from: "1.0.0"),
```

### CocoaPods

```ruby
pod 'SubstreamSDK', '~> 1.0'
```

### Manual / xcframework

Download `SubstreamSDK.xcframework.zip` from the [latest GitHub release](https://github.com/jlin3/substream-sdk/releases), unzip, and drag into your project's **Frameworks, Libraries, and Embedded Content** section (embed & sign).

---

## Quick start — Metal / MTKView game

```swift
import SubstreamSDK

let session = try await Substream.startStream(
    .init(
        backendUrl: URL(string: "https://api.substream.dev")!,
        authToken: "sk_live_…",
        streamerId: "player-456",
        capture: .metalView(self.gameView)
    )
)

print("Live!", session.viewerUrl)

// Later
await session.stop()
```

That's it. The SDK:

1. POSTs to `/api/streams/web-publish` to allocate an IVS Real-Time stage and get a participant token
2. Joins the stage via `AmazonIVSBroadcast.IVSStage`
3. Streams your `MTKView`'s rendered frames + game audio
4. Emits `session.events` as the connection state changes
5. DELETEs the stream on `session.stop()`

### Other capture modes

```swift
// SpriteKit
capture: .spriteKit(skView)

// SceneKit
capture: .sceneKit(scnView)

// Generic CAMetalLayer
capture: .metalLayer(myMetalLayer)

// Any UIView (fallback, uses UIGraphicsImageRenderer — slower)
capture: .uiView(myView)

// In-app ReplayKit (requires user permission; foreground only)
capture: .replayKit

// System-wide capture via Broadcast Upload Extension
capture: .broadcastExtension(appGroup: "group.com.acme.mygame")
```

### Observing events

```swift
for await event in session.events {
    switch event {
    case .connecting: /* … */ break
    case .live(let info): print("Viewer:", info.viewerUrl)
    case .reconnecting(let attempt): print("Retry #\(attempt)")
    case .statsUpdated(let s): print("\(s.bitrateKbps) kbps @ \(s.fps) fps")
    case .stopped: break
    }
}
```

---

## Permissions

Add these keys to your app's **Info.plist**:

| Key | Reason |
|---|---|
| `NSMicrophoneUsageDescription` | Required when `config.audio == true` or using ReplayKit with mic |
| `NSCameraUsageDescription` | Only needed if you also add a front-facing "face cam" later |

ReplayKit and Broadcast Upload Extension flows are documented in [Sources/SubstreamSDK/BroadcastExtension/README.md](Sources/SubstreamSDK/BroadcastExtension/README.md).

---

## Architecture

```
┌──────────────┐    POST /api/streams/web-publish     ┌──────────────┐
│  iOS game    │────────────────────────────────────▶ │  Substream   │
│              │                                       │  backend     │
│  MTKView /   │◀─────── IVS participant token ─────── │  (IVS pool)  │
│  ReplayKit / │                                       └──────────────┘
│  UIView      │                                              │
│              │──── WebRTC (AmazonIVSBroadcast) ────▶ IVS Real-Time
└──────────────┘                                              │
                                                              ▼
                                                       Viewers
                                                       /viewer/{id}
```

Same backend contract as [`@substream/web-sdk`](../web-sdk). One backend, many clients.

---

## Example app

See [`Example/`](Example/) for a full SpriteKit "Breakout"-style game with a SwiftUI "Go Live" button that demonstrates every capture mode and a Broadcast Upload Extension target.

---

## Development

```bash
cd packages/ios-sdk
swift build
swift test
```

The xcframework is produced by `Scripts/build_xcframework.sh` and attached to GitHub releases by `.github/workflows/ios.yml`.

---

## License

MIT — see [LICENSE](LICENSE).
