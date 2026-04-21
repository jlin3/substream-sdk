// BroadcastExtensionBridgeSource.swift
// Host-app-side stub used when `config.capture == .broadcastExtension(appGroup:)`.
//
// System-wide capture via a Broadcast Upload Extension is a two-process dance:
//
//   1. Host app writes `SubstreamBroadcastConfig` to the shared App Group.
//   2. User taps the in-app `RPSystemBroadcastPickerView` button.
//   3. iOS launches the extension in a separate process.
//   4. The extension's `SubstreamBroadcastHandler` calls `Substream.startStream(...)`
//      from *inside* the extension and publishes frames.
//
// That means the host app's `Substream.startStream` call is really a setup
// step — it just validates + persists config and returns a no-op session
// whose `events` mirror a minimal lifecycle. The extension owns the real
// IVS connection.
//
// This is the cleanest separation given that the extension is sandboxed
// from the host app's memory.

import CoreMedia
import CoreVideo
import Foundation

final class BroadcastExtensionBridgeSource: SubstreamImageSource {

    var targetFps: Int
    let appGroup: String

    init(appGroup: String, targetFps: Int) {
        self.appGroup = appGroup
        self.targetFps = targetFps
    }

    func attach(sink: SubstreamImageSink) {
        // No-op: samples arrive in the extension process, not here.
    }

    func start() throws {
        // Sanity-check that the App Group is reachable. Throws if the app
        // doesn't have the entitlement configured.
        guard UserDefaults(suiteName: appGroup) != nil else {
            throw SubstreamError.captureUnavailable(
                "App Group '\(appGroup)' is not reachable. "
                    + "Add it to both the host app and the Broadcast Upload Extension entitlements."
            )
        }
        let groupName = appGroup
        Log.info(
            "Broadcast Upload Extension configured (appGroup=\(groupName)). "
                + "Present RPSystemBroadcastPickerView to begin system-wide capture.",
            category: Log.capture
        )
    }

    func stop() {
        SubstreamBroadcastConfig.clear(appGroup: appGroup)
    }
}
