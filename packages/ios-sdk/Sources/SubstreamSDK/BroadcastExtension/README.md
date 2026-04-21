# Broadcast Upload Extension — Integration guide

System-wide streaming on iOS requires a **Broadcast Upload Extension** target. Unlike in-app ReplayKit, it keeps streaming even when the user switches apps, receives a call, or locks the screen.

This guide walks through adding a Broadcast Upload Extension to your app that forwards every frame + audio sample to Substream.

---

## Architecture

```
┌─────────────────────┐           ┌─────────────────────────┐
│   Host app process  │           │  Extension process      │
│                     │           │                         │
│  SubstreamBroadcast │   App     │  SubstreamBroadcast     │
│  Config.save(...)   │ ◀─Group─▶│  Handler (your subclass)│
│                     │  defaults │                         │
│  RPSystemBroadcast  │           │  Substream.startStream  │
│  PickerView         │─system──▶│  → AmazonIVSBroadcast   │
└─────────────────────┘  picker   └─────────────────────────┘
                                           │
                                           ▼
                                   IVS Real-Time stage
                                   → /viewer/{id}
```

The extension holds the IVS connection because that's where the frames live. The host app only *configures* the extension by writing auth + streamerId into a shared App Group UserDefaults.

---

## Step-by-step

### 1. Add an App Group

In Xcode, open your app's **Signing & Capabilities** tab.

1. Click **+ Capability** → **App Groups**.
2. Add a group like `group.com.acme.mygame`.
3. Repeat for the extension target (after step 2).

### 2. Create the extension target

**File → New → Target → Broadcast Upload Extension**

- Name: `MyGameBroadcast`
- Bundle ID: `com.acme.mygame.broadcast`
- **Include UI Extension**: No (unless you want a stop button UI)

### 3. Link SubstreamSDK into the extension

Edit the extension target's **Frameworks and Libraries** and add `SubstreamSDK`.

### 4. Replace `SampleHandler.swift`

```swift
import SubstreamSDK

class SampleHandler: SubstreamBroadcastHandler {
    override var appGroup: String { "group.com.acme.mygame" }
    override var targetFps: Int { 30 }
}
```

That's it for the extension side.

### 5. Start a broadcast from the host app

```swift
import SubstreamSDK
import ReplayKit

// 1. Persist config for the extension to read
try SubstreamBroadcastConfig.save(
    .init(
        backendUrl: URL(string: "https://api.substream.dev")!,
        authToken: "sk_live_…",
        streamerId: "player-456"
    ),
    appGroup: "group.com.acme.mygame"
)

// 2. Present the system broadcast picker
let picker = RPSystemBroadcastPickerView(frame: CGRect(x: 0, y: 0, width: 60, height: 60))
picker.preferredExtension = "com.acme.mygame.broadcast"
picker.showsMicrophoneButton = true
view.addSubview(picker)
```

When the user taps **Start Broadcast**, iOS launches your extension. `SubstreamBroadcastHandler.broadcastStarted(...)` reads the saved config, opens the IVS stage, and begins streaming.

### 6. Stop

The extension calls `Substream.stop()` automatically when the user taps **Stop Broadcast** in the status bar, or you can end programmatically via `RPScreenRecorder.shared().stopRecording`.

---

## Memory limits

Broadcast Upload Extensions are capped at **50 MB** of RSS. SubstreamSDK stays well under that because:

- Pixel buffers flow directly from ReplayKit to IVS via `CVPixelBuffer` — no copies.
- We never retain frames past the IVS `onSampleBuffer` call.
- Audio samples are forwarded by reference.

If you add your own overlays or heavy processing, audit with Instruments → Leaks + Allocations against the extension process.

---

## Auth token rotation

Because the extension reads the token from App Group UserDefaults, **rotate short-lived tokens frequently**. Recommended flow:

1. Your auth backend issues a 5-minute JWT for the streamer.
2. Host app saves that JWT into the App Group *immediately before* presenting the picker.
3. Extension uses it to call the Substream backend exactly once — the backend returns an IVS participant token that's valid for the full stream.

This keeps long-lived secrets out of the shared container.

---

## Troubleshooting

| Symptom | Fix |
|---|---|
| `App Group '…' is not reachable` | Add the App Group entitlement to **both** the host app and the extension |
| Extension dies within 5s of starting | Check that you set `preferredExtension` to the *extension's* bundle ID, not the app's |
| No audio | Ensure `showsMicrophoneButton = true` **and** the user tapped the mic icon in the picker |
| Stream stops on lock screen | That's expected on older iOS; newer iOS supports background broadcast — test on iOS 14+ |
| Extension uses >50MB | Disable HDR / 4K; the SDK targets 720p@30fps by default which stays around 15 MB |
