// ImageSourceBridge.swift
// Internal protocol every capture source conforms to.
//
// Capture sources produce `CVPixelBuffer`s and feed them into
// `AmazonIVSBroadcast.IVSCustomImageSource` via `onSampleBuffer`.
// Decoupling this behind a protocol lets us unit-test sources without IVS.

import CoreMedia
import CoreVideo
import Foundation

/// Receives frames from a capture source.
protocol SubstreamImageSink: AnyObject {
    /// Called on the capture queue with the latest frame.
    ///
    /// - Parameters:
    ///   - pixelBuffer: A BGRA or NV12 `CVPixelBuffer`. Ownership is borrowed;
    ///     the sink must retain via `CFRetain`/CMSampleBuffer if it needs the
    ///     pixels beyond the call's return.
    ///   - presentationTime: The host-time timestamp for the frame.
    func consume(pixelBuffer: CVPixelBuffer, presentationTime: CMTime)
}

/// Anything that can be started/stopped and push frames to a sink.
protocol SubstreamImageSource: AnyObject {
    /// FPS target; a source may produce fewer frames under thermal pressure.
    var targetFps: Int { get set }

    /// Install the frame sink. Called once before `start()`.
    func attach(sink: SubstreamImageSink)

    /// Begin producing frames.
    func start() throws

    /// Stop producing frames and release any held textures / pools.
    func stop()
}

/// Bridge type used by audio sources — we keep this minimal because
/// `AmazonIVSBroadcast.IVSCustomAudioSource` accepts `CMSampleBuffer` directly.
protocol SubstreamAudioSink: AnyObject {
    func consume(sampleBuffer: CMSampleBuffer)
}

protocol SubstreamAudioSource: AnyObject {
    func attach(sink: SubstreamAudioSink)
    func start() throws
    func stop()
}
