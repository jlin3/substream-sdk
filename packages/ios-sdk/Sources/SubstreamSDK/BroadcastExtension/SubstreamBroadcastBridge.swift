// SubstreamBroadcastBridge.swift
// Singleton that lets `SubstreamBroadcastHandler.processSampleBuffer`
// deliver ReplayKit samples into the SDK's ReplayKit capture source.
//
// This is intentionally a singleton because a Broadcast Upload Extension
// is a separate process with exactly one SampleHandler instance alive at a
// time. Memory footprint must stay below 50 MB, so we avoid holding frames.

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

    /// Retained by `SubstreamBroadcastHandler` to keep the session alive.
    var session: SubstreamSession?

    /// Set by the SDK's capture factory so we can push samples in.
    #if canImport(ReplayKit) && canImport(UIKit)
        weak var imageSource: ReplayKitInAppSource?
    #endif
    weak var audioSource: ReplayKitAudioSource?

    private init() {}

    #if canImport(ReplayKit) && canImport(UIKit)
        func forward(sampleBuffer: CMSampleBuffer, bufferType: RPSampleBufferType) {
            switch bufferType {
            case .video:
                guard let imageSource else { return }
                guard let pb = CMSampleBufferGetImageBuffer(sampleBuffer) else { return }
                let pts = CMSampleBufferGetPresentationTimeStamp(sampleBuffer)
                imageSource.deliver(pixelBuffer: pb, pts: pts)
            case .audioApp, .audioMic:
                audioSource?.forward(sampleBuffer)
            @unknown default:
                break
            }
        }
    #endif
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
