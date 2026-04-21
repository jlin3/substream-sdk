// ReplayKitAudioSource.swift
// Bridge used by the ReplayKit capture sources. The actual audio sample
// buffers arrive inside the ReplayKit frame handlers; this source just
// holds the sink reference so `ReplayKitInAppSource` /
// `BroadcastExtensionBridgeSource` can push them through.

import CoreMedia
import Foundation

final class ReplayKitAudioSource: SubstreamAudioSource {
    private weak var sink: SubstreamAudioSink?

    func attach(sink: SubstreamAudioSink) { self.sink = sink }

    func start() throws {
        // ReplayKit capture drives the audio fan-out itself. Nothing to do here.
    }

    func stop() {}

    /// Public entry point the ReplayKit capture sources call to forward a sample.
    func forward(_ sampleBuffer: CMSampleBuffer) {
        sink?.consume(sampleBuffer: sampleBuffer)
    }
}
