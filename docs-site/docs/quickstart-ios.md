---
sidebar_position: 4
title: "Quick Start: iOS"
---

# Quick Start: iOS

Add live streaming to any iOS game — Metal, SpriteKit, SceneKit, UIKit, or system-wide via ReplayKit.

The SDK wraps the Amazon IVS Broadcast SDK and uses the same backend contract as `@substream/web-sdk`, so you can bring your own Substream platform instance or use the hosted demo backend.

Supports **iOS 14+**, arm64 device + simulator.

---

## 1. Install

### Swift Package Manager

In Xcode: **File → Add Packages…** and paste:

```
https://github.com/jlin3/substream-sdk
```

Select the `SubstreamSDK` product.

### CocoaPods

```ruby
pod 'SubstreamSDK', '~> 1.0'
```

Then `pod install` and open your `.xcworkspace`.

### Manual xcframework

Download `SubstreamSDK.xcframework.zip` from the [latest release](https://github.com/jlin3/substream-sdk/releases) and drag it into **Frameworks, Libraries, and Embedded Content** (embed & sign).

---

## 2. Add permissions

Add to your app's **Info.plist**:

```xml
<key>NSMicrophoneUsageDescription</key>
<string>This game streams your commentary alongside gameplay.</string>
```

(Only required if you'll capture audio — which is the default.)

---

## 3. Go live

```swift
import SubstreamSDK

let session = try await Substream.startStream(
    .init(
        backendUrl: URL(string: "https://substream-sdk-production.up.railway.app")!,
        authToken: "demo-token",
        streamerId: "demo-child-001",
        capture: .metalView(self.gameView)
    )
)

print("Live!", session.viewerUrl)
```

That's it. You're streaming to `/viewer/{streamId}` with sub-second latency.

---

## Capture modes

| Case | When to use |
|---|---|
| `.metalView(MTKView)` | Metal-based games. Zero-copy blit into a BGRA `CVPixelBuffer`. |
| `.metalLayer(CAMetalLayer)` | Custom render loops managing their own `CAMetalLayer`. |
| `.spriteKit(SKView)` | SpriteKit games (Breakout, card games, 2D RPGs). |
| `.sceneKit(SCNView)` | SceneKit games / 3D model viewers. |
| `.uiView(UIView)` | Generic UIKit view tree fallback (slowest). |
| `.replayKit` | Full-screen in-app capture. Requires user permission. |
| `.broadcastExtension(appGroup:)` | System-wide capture via a Broadcast Upload Extension. Keeps streaming when the user switches apps. |

Full broadcast-extension setup: [`Sources/SubstreamSDK/BroadcastExtension/README.md`](https://github.com/jlin3/substream-sdk/blob/main/packages/ios-sdk/Sources/SubstreamSDK/BroadcastExtension/README.md).

---

## Observing events

```swift
for await event in session.events {
    switch event {
    case .connecting:
        print("⏳ connecting")
    case .live(let info):
        print("🔴 live →", info.viewerUrl)
    case .reconnecting(let attempt):
        print("🔁 retry #\(attempt)")
    case .statsUpdated(let s):
        print("📊 \(s.bitrateKbps)kbps \(s.fps)fps \(s.health.rawValue)")
    case .stopped:
        print("⏹ stopped")
    case .warning(let msg):
        print("⚠️", msg)
    }
}
```

---

## Stopping

```swift
await session.stop()
```

Safe to call multiple times. The SDK handles backgrounding, thermal throttling, and reconnection automatically.

---

## Example app

See [packages/ios-sdk/Example/](https://github.com/jlin3/substream-sdk/tree/main/packages/ios-sdk/Example) for a full SpriteKit "Breakout"-style game with a SwiftUI **Go Live** button, wired to the same Railway demo backend that powers the web demo.

```bash
brew install xcodegen
cd packages/ios-sdk/Example
xcodegen
open SubstreamDemo.xcodeproj
```

---

## Advanced

### Streaming game audio, not the mic

Tap your existing `AVAudioEngine`:

```swift
let audioEngine: AVAudioEngine = myGameAudioEngine

let session = try await Substream.startStream(
    .init(
        backendUrl: ...,
        authToken: ...,
        streamerId: ...,
        capture: .metalView(gameView),
        audioSource: .gameAudioEngine(AVAudioEngineRef(audioEngine))
    )
)
```

### Custom bitrate / fps

```swift
.init(
    ...,
    fps: 60,
    videoBitrateKbps: 4500,
    adaptiveQuality: true
)
```

`adaptiveQuality: true` automatically drops fps + bitrate under thermal pressure or low power mode.

### Runtime mute

```swift
session.setMuted(true)   // mic/audio goes silent
session.setMuted(false)  // unmute
```
