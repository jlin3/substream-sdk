// ReplayKitInAppSource.swift
// In-app ReplayKit capture via `RPScreenRecorder.startCapture(handler:)`.
//
// Limitations (documented for developers):
//   - Only runs while the app is foregrounded. For background capture use
//     `.broadcastExtension(appGroup:)` instead.
//   - Requires user consent — the first call shows the system permission UI.
//   - Yields both video (`CMSampleBufferType.video`) and audio samples
//     (`.audioApp` / `.audioMic`).
//
// Video samples from ReplayKit are already `CMSampleBuffer`s backed by
// `CVPixelBuffer`, so we forward the pixel buffer directly without copying.

#if canImport(ReplayKit) && canImport(UIKit)

    import CoreMedia
    import CoreVideo
    import Foundation
    import ReplayKit

    final class ReplayKitInAppSource: NSObject, SubstreamImageSource {

        var targetFps: Int

        private weak var imageSink: SubstreamImageSink?
        private let includeMicrophone: Bool
        private let recorder = RPScreenRecorder.shared()

        /// Optional — when the SDK wires ReplayKit audio through, it uses this.
        var audioSource: ReplayKitAudioSource?

        init(targetFps: Int, includeMicrophone: Bool) {
            self.targetFps = targetFps
            self.includeMicrophone = includeMicrophone
            super.init()
        }

        func attach(sink: SubstreamImageSink) { self.imageSink = sink }

        /// Called by the Broadcast Upload Extension bridge to push a frame.
        func forwardToSink(pixelBuffer: CVPixelBuffer, pts: CMTime) {
            imageSink?.consume(pixelBuffer: pixelBuffer, presentationTime: pts)
        }

        func start() throws {
            guard recorder.isAvailable else {
                throw SubstreamError.captureUnavailable("ReplayKit is not available on this device")
            }
            recorder.isMicrophoneEnabled = includeMicrophone

            let sema = DispatchSemaphore(value: 0)
            var startError: Error?
            recorder.startCapture(
                handler: { [weak self] sampleBuffer, bufferType, error in
                    if let error {
                        Log.warn("ReplayKit sample error: \(error)", category: Log.capture)
                        return
                    }
                    self?.handle(sampleBuffer: sampleBuffer, bufferType: bufferType)
                },
                completionHandler: { error in
                    startError = error
                    sema.signal()
                }
            )
            _ = sema.wait(timeout: .now() + 5)

            if let e = startError {
                throw SubstreamError.captureUnavailable(
                    "ReplayKit.startCapture failed: \(e.localizedDescription)"
                )
            }
        }

        func stop() {
            guard recorder.isRecording else { return }
            recorder.stopCapture { error in
                if let error { Log.warn("ReplayKit stopCapture error: \(error)", category: Log.capture) }
            }
        }

        // MARK: - Sample handling

        private func handle(sampleBuffer: CMSampleBuffer, bufferType: RPSampleBufferType) {
            switch bufferType {
            case .video:
                guard let pixelBuffer = CMSampleBufferGetImageBuffer(sampleBuffer) else { return }
                let pts = CMSampleBufferGetPresentationTimeStamp(sampleBuffer)
                imageSink?.consume(pixelBuffer: pixelBuffer, presentationTime: pts)
            case .audioApp, .audioMic:
                audioSource?.forward(sampleBuffer)
            @unknown default:
                break
            }
        }
    }

#endif
