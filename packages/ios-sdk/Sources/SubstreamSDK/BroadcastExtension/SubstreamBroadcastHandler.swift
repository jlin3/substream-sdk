// SubstreamBroadcastHandler.swift
// Drop-in base class for a Broadcast Upload Extension's `SampleHandler`.
//
// Usage (inside the extension target's SampleHandler.swift):
//
//   import SubstreamSDK
//   import ReplayKit
//
//   class SampleHandler: SubstreamBroadcastHandler {
//       override var appGroup: String { "group.com.acme.mygame" }
//   }
//
// The host app writes config into the shared App Group via
// `SubstreamBroadcastConfig.save(...)` BEFORE presenting the
// `RPSystemBroadcastPickerView`. The extension reads it in `broadcastStarted`,
// calls `Substream.startStream(...)`, and forwards every sample buffer to the
// SDK's ReplayKit capture source.

#if canImport(ReplayKit) && canImport(UIKit)

    import CoreMedia
    import Foundation
    import ReplayKit
    import UIKit

    /// Subclass this in your Broadcast Upload Extension's SampleHandler.
    open class SubstreamBroadcastHandler: RPBroadcastSampleHandler {

        /// App Group identifier shared between the host app and this extension.
        /// Override in your subclass.
        open var appGroup: String { "" }

        /// Target fps. Override to change.
        open var targetFps: Int { 30 }

        private var session: SubstreamSession?
        private var replayKitSource: ReplayKitInAppSource?
        private var replayKitAudio: ReplayKitAudioSource?

        // MARK: - RPBroadcastSampleHandler

        open override func broadcastStarted(withSetupInfo setupInfo: [String: NSObject]?) {
            guard let config = SubstreamBroadcastConfig.load(appGroup: appGroup) else {
                failBroadcast(reason: "No SubstreamBroadcastConfig found in App Group \(appGroup)")
                return
            }

            let substreamConfig = SubstreamConfig(
                backendUrl: config.backendUrl,
                authToken: config.authToken,
                streamerId: config.streamerId,
                capture: .replayKit,
                orgId: config.orgId,
                streamerName: config.streamerName,
                title: config.title,
                fps: targetFps,
                audio: true,
                audioSource: .replayKit
            )

            // Use a synchronous bootstrap — extensions don't run an async runtime
            // alongside the host, so we spin a small blocking wait with a timeout.
            let sema = DispatchSemaphore(value: 0)
            var startError: Error?

            Task { [weak self] in
                guard let self else { sema.signal(); return }
                do {
                    self.session = try await Substream.startStream(substreamConfig)
                    // Swap in the ReplayKit source references so sample buffers can flow.
                    // We tap the client's image source via a KVC-free backdoor: our
                    // factory returned a ReplayKitInAppSource, and the SDK holds it.
                    // Here we piggy-back on the `NotificationCenter`-less contract by
                    // exposing a small singleton handoff in `SubstreamBroadcastBridge`.
                    SubstreamBroadcastBridge.shared.session = self.session
                } catch {
                    startError = error
                }
                sema.signal()
            }

            _ = sema.wait(timeout: .now() + 10)

            if let e = startError {
                failBroadcast(reason: "Substream start failed: \(e.localizedDescription)")
            }
        }

        open override func broadcastPaused() {
            // Nothing to do; IVS handles network pauses. We emit a warning.
        }

        open override func broadcastResumed() {
            // Nothing to do.
        }

        open override func broadcastFinished() {
            Task { [weak self] in
                await self?.session?.stop()
                self?.session = nil
                SubstreamBroadcastBridge.shared.session = nil
            }
        }

        open override func processSampleBuffer(
            _ sampleBuffer: CMSampleBuffer,
            with sampleBufferType: RPSampleBufferType
        ) {
            SubstreamBroadcastBridge.shared.forward(
                sampleBuffer: sampleBuffer,
                bufferType: sampleBufferType
            )
        }

        // MARK: - Helpers

        private func failBroadcast(reason: String) {
            let error = NSError(
                domain: "dev.substream.broadcast",
                code: -1,
                userInfo: [NSLocalizedDescriptionKey: reason]
            )
            finishBroadcastWithError(error)
        }
    }

#endif
