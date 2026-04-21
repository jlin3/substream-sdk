// AudioFormatHelpers.swift
// Helpers to convert `AVAudioPCMBuffer` → `CMSampleBuffer` and to build
// a consistent 48kHz / 2ch / 16-bit PCM format for the outgoing stream.

#if canImport(AVFoundation)

    import AVFoundation
    import CoreMedia
    import Foundation

    enum AudioFormatHelpers {

        /// The SDK's canonical outgoing audio format: 48kHz stereo 16-bit interleaved.
        static func canonicalFormat() -> AVAudioFormat? {
            AVAudioFormat(
                commonFormat: .pcmFormatInt16,
                sampleRate: 48_000,
                channels: 2,
                interleaved: true
            )
        }

        /// Convert an `AVAudioPCMBuffer` into a `CMSampleBuffer` suitable for IVS.
        static func sampleBuffer(from buffer: AVAudioPCMBuffer, pts: CMTime) -> CMSampleBuffer? {
            var asbdVar = buffer.format.streamDescription.pointee

            var format: CMAudioFormatDescription?
            let ok = CMAudioFormatDescriptionCreate(
                allocator: kCFAllocatorDefault,
                asbd: &asbdVar,
                layoutSize: 0,
                layout: nil,
                magicCookieSize: 0,
                magicCookie: nil,
                extensions: nil,
                formatDescriptionOut: &format
            )
            guard ok == noErr, let format else { return nil }

            var sampleBuffer: CMSampleBuffer?
            let frames = CMItemCount(buffer.frameLength)
            let status = CMSampleBufferCreate(
                allocator: kCFAllocatorDefault,
                dataBuffer: nil,
                dataReady: false,
                makeDataReadyCallback: nil,
                refcon: nil,
                formatDescription: format,
                sampleCount: frames,
                sampleTimingEntryCount: 1,
                sampleTimingArray: [
                    CMSampleTimingInfo(
                        duration: CMTime(value: 1, timescale: CMTimeScale(asbdVar.mSampleRate)),
                        presentationTimeStamp: pts,
                        decodeTimeStamp: .invalid
                    )
                ],
                sampleSizeEntryCount: 0,
                sampleSizeArray: nil,
                sampleBufferOut: &sampleBuffer
            )
            guard status == noErr, let sb = sampleBuffer else { return nil }

            let abl = buffer.audioBufferList
            CMSampleBufferSetDataBufferFromAudioBufferList(
                sb,
                blockBufferAllocator: kCFAllocatorDefault,
                blockBufferMemoryAllocator: kCFAllocatorDefault,
                flags: 0,
                bufferList: abl
            )

            return sb
        }
    }

#endif
