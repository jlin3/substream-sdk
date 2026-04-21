// SampleBufferBuilder.swift
// Wraps a `CVPixelBuffer` in a `CMSampleBuffer` so IVS's custom image source
// can consume it. Hot path — we keep allocations minimal.

import CoreMedia
import CoreVideo
import Foundation

enum SubstreamSampleBufferBuilder {

    /// Wrap a pixel buffer as a sample buffer with the given presentation time.
    ///
    /// Returns a synthetic `CMSampleBuffer` with a single-frame timing. IVS
    /// expects sample buffers with CMVideoFormatDescription — we build one here.
    static func make(pixelBuffer: CVPixelBuffer, pts: CMTime) -> CMSampleBuffer {
        var formatDesc: CMVideoFormatDescription?
        CMVideoFormatDescriptionCreateForImageBuffer(
            allocator: kCFAllocatorDefault,
            imageBuffer: pixelBuffer,
            formatDescriptionOut: &formatDesc
        )

        var timing = CMSampleTimingInfo(
            duration: .invalid,
            presentationTimeStamp: pts,
            decodeTimeStamp: .invalid
        )

        var sampleBuffer: CMSampleBuffer?
        CMSampleBufferCreateForImageBuffer(
            allocator: kCFAllocatorDefault,
            imageBuffer: pixelBuffer,
            dataReady: true,
            makeDataReadyCallback: nil,
            refcon: nil,
            formatDescription: formatDesc!,
            sampleTiming: &timing,
            sampleBufferOut: &sampleBuffer
        )
        return sampleBuffer!
    }
}
