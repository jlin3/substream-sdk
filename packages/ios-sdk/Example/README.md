# SubstreamDemo — Example iOS app

A SpriteKit "Breakout"-style game with a SwiftUI **Go Live** screen that demonstrates every capture mode supported by `SubstreamSDK`.

## What it shows

- `.spriteKit(SKView)` — capture the Breakout game's SpriteKit view
- `.metalView(MTKView)` — capture a simple MTKView shader demo
- `.uiView(UIView)` — generic UIView fallback
- `.replayKit` — full-screen in-app capture with a mic
- `.broadcastExtension(appGroup:)` — system-wide capture via the bundled `SubstreamBroadcast` extension target

It ships wired to the same Railway demo backend that powers the web demo:

| Setting | Value |
|---|---|
| `backendUrl` | `https://substream-sdk-production.up.railway.app` |
| `authToken` | `demo-token` |
| `streamerId` | `demo-child-001` |
| `viewer URL` | `https://substream-sdk-production.up.railway.app/viewer/{streamId}` |

## Structure

```
Example/
├── README.md                 ← this file
├── project.yml               ← XcodeGen spec (generates SubstreamDemo.xcodeproj)
├── SubstreamDemo/            ← main app target
│   ├── AppDelegate.swift
│   ├── SceneDelegate.swift
│   ├── ContentView.swift     ← SwiftUI root + "Go Live" button
│   ├── GoLiveViewModel.swift ← session orchestration
│   ├── BreakoutScene.swift   ← SpriteKit game
│   ├── GameView.swift        ← UIViewRepresentable wrapping SKView
│   ├── Info.plist
│   └── Assets.xcassets/...
└── SubstreamBroadcast/       ← Broadcast Upload Extension target
    ├── SampleHandler.swift
    └── Info.plist
```

## Generating the Xcode project

We don't check a binary `.xcodeproj` into git. Generate one with [XcodeGen](https://github.com/yonaskolb/XcodeGen):

```bash
brew install xcodegen
cd packages/ios-sdk/Example
xcodegen
open SubstreamDemo.xcodeproj
```

## Running on device

1. Enable an App Group shared between both targets (e.g. `group.dev.substream.demo`).
2. Add your Team ID in Xcode's **Signing & Capabilities**.
3. Point both targets at the same bundle ID prefix, e.g. `dev.substream.demo` + `dev.substream.demo.broadcast`.
4. Run on an iOS 14+ device (simulator works for `.spriteKit` / `.uiView` but ReplayKit won't capture audio).
5. Open the dashboard at `{backendUrl}/api/auth/demo-auto` in a browser to watch your stream go live.

## Installing the SDK in the example

Because this example lives inside the monorepo, it links `SubstreamSDK` as a **local SwiftPM package** via `project.yml`. If you copy the example out, switch to the remote dependency:

```swift
.package(url: "https://github.com/jlin3/substream-sdk.git", from: "1.0.0")
```
