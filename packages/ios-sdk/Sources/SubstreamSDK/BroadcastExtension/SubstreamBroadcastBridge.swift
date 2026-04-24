// SubstreamBroadcastBridge.swift
// Singleton that lets `SubstreamBroadcastHandler.processSampleBuffer`
// deliver ReplayKit samples into the SDK's ReplayKit capture source.
//
// This is intentionally a singleton because a Broadcast Upload Extension
// is a separate process with exactly one SampleHandler instance alive at a
// time. Memory footprint must stay below 50 MB, so we avoid holding frames.
//
// Thread-safety: mutable state (`session`, `imageSource`, `audioSource`)
// is set from the main-actor-ish Task that boots the stream and read from
// the sample-buffer queue that ReplayKit delivers frames on. All access
// is serialized through an internal `NSLock`. The `forward(...)` hot path
// snapshots the references under the lock, then releases the lock before
// calling into the capture sources so we don't hold the lock across a
// potentially expensive frame push.

import CoreMedia
import CoreVideo
import Foundation

#if canImport(UIKit)
    import UIKit
#endif
#if canImport(ReplayKit)
    import ReplayKit
#endif

/// Shared relay between the extension's SampleHandler and the SDK's
/// `ReplayKitInAppSource` / `ReplayKitAudioSource`.
final class SubstreamBroadcastBridge: @unchecked Sendable {

    static let shared = SubstreamBroadcastBridge()

    // MARK: - Storage

    private let lock = NSLock()
    private var _session: SubstreamSession?

    #if canImport(ReplayKit) && canImport(UIKit)
        private weak var _imageSource: ReplayKitInAppSource?
    #endif
    private weak var _audioSource: ReplayKitAudioSource?

    private init() {}

    // MARK: - Public accessors (lock-serialized)

    /// Retained by `SubstreamBroadcastHandler` to keep the session alive.
    var session: SubstreamSession? {
        get { withLock { _session } }
        set { withLock { _session = newValue } }
    }

    #if canImport(ReplayKit) && canImport(UIKit)
        var imageSource: ReplayKitInAppSource? {
            get { withLock { _imageSource } }
            set { withLock { _imageSource = newValue } }
        }
    #endif

    var audioSource: ReplayKitAudioSource? {
        get { withLock { _audioSource } }
        set { withLock { _audioSource = newValue } }
    }

    // MARK: - Hot path

    #if canImport(ReplayKit) && canImport(UIKit)
        func forward(sampleBuffer: CMSampleBuffer, bufferType: RPSampleBufferType) {
            // Snapshot the refs under the lock, then release before calling
            // into the sinks to avoid holding the lock on the frame-push path.
            let (image, audio): (ReplayKitInAppSource?, ReplayKitAudioSource?) = withLock {
                (_imageSource, _audioSource)
            }

            switch bufferType {
            case .video:
                guard let image else { return }
                guard let pb = CMSampleBufferGetImageBuffer(sampleBuffer) else { return }
                let pts = CMSampleBufferGetPresentationTimeStamp(sampleBuffer)
                image.deliver(pixelBuffer: pb, pts: pts)
            case .audioApp, .audioMic:
                audio?.forward(sampleBuffer)
            @unknown default:
                break
            }
        }
    #endif

    // MARK: - Helpers

    private func withLock<T>(_ body: () -> T) -> T {
        lock.lock()
        defer { lock.unlock() }
        return body()
    }
}

// Expose a narrow delivery API on `ReplayKitInAppSource` so the bridge can
// push frames without the handler knowing the sink protocol.
#if canImport(ReplayKit) && canImport(UIKit)
    extension ReplayKitInAppSource {
        /// Called by `SubstreamBroadcastBridge` — forwards to the attached sink.
        func deliver(pixelBuffer: CVPixelBuffer, pts: CMTime) {
            // The sink is stored by `attach(sink:)` and consumed here. We use a
            // small trampoline so the bridge doesn't need to know the protocol.
            forwardToSink(pixelBuffer: pixelBuffer, pts: pts)
        }
    }
#endif
