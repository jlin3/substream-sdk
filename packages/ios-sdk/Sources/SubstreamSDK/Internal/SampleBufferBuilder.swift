// SampleBufferBuilder.swift
// Wraps a `CVPixelBuffer` in a `CMSampleBuffer` so IVS's custom image source
// can consume it. Hot path — we keep allocations minimal and never crash
// the game on a transient Core Media allocation failure.

import CoreMedia
import CoreVideo
import Foundation

enum SubstreamSampleBufferBuilder {

    /// Wrap a pixel buffer as a sample buffer with the given presentation time.
    ///
    /// Returns a synthetic `CMSampleBuffer` with a single-frame timing, or
    /// `nil` if either the format description or the sample buffer couldn't
    /// be allocated. Callers treat `nil` as a dropped frame — never a crash.
    static func make(pixelBuffer: CVPixelBuffer, pts: CMTime) -> CMSampleBuffer? {
        var formatDesc: CMVideoFormatDescription?
        let fmtStatus = CMVideoFormatDescriptionCreateForImageBuffer(
            allocator: kCFAllocatorDefault,
            imageBuffer: pixelBuffer,
            formatDescriptionOut: &formatDesc
        )
        guard fmtStatus == noErr, let formatDesc else {
            Log.warn("SampleBufferBuilder: format desc failed (\(fmtStatus))", category: Log.capture)
            return nil
        }

        var timing = CMSampleTimingInfo(
            duration: .invalid,
            presentationTimeStamp: pts,
            decodeTimeStamp: .invalid
        )

        var sampleBuffer: CMSampleBuffer?
        let sbStatus = CMSampleBufferCreateForImageBuffer(
            allocator: kCFAllocatorDefault,
            imageBuffer: pixelBuffer,
            dataReady: true,
            makeDataReadyCallback: nil,
            refcon: nil,
            formatDescription: formatDesc,
            sampleTiming: &timing,
            sampleBufferOut: &sampleBuffer
        )
        guard sbStatus == noErr, let sampleBuffer else {
            Log.warn("SampleBufferBuilder: sample buffer failed (\(sbStatus))", category: Log.capture)
            return nil
        }
        return sampleBuffer
    }
}
