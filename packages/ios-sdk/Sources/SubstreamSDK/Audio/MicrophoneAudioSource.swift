// MicrophoneAudioSource.swift
// Captures the device microphone via an owned `AVAudioEngine` + input tap.
//
// Host apps that want *game* audio should use `.gameAudioEngine(engine)`
// instead — mic alone is a commentary-style fallback.

#if canImport(AVFoundation)

    import AVFoundation
    import CoreMedia
    import Foundation

    final class MicrophoneAudioSource: SubstreamAudioSource {

        private let engine = AVAudioEngine()
        private weak var sink: SubstreamAudioSink?
        private var tapInstalled = false
        private var samplesSent: Int64 = 0

        func attach(sink: SubstreamAudioSink) { self.sink = sink }

        func start() throws {
            let input = engine.inputNode
            let format = input.outputFormat(forBus: 0)

            input.installTap(onBus: 0, bufferSize: 1024, format: format) {
                [weak self] buffer, _ in
                guard let self, let sink = self.sink else { return }
                let sampleRate = buffer.format.sampleRate
                let pts = CMTime(value: self.samplesSent, timescale: CMTimeScale(sampleRate))
                self.samplesSent += Int64(buffer.frameLength)
                if let sb = AudioFormatHelpers.sampleBuffer(from: buffer, pts: pts) {
                    sink.consume(sampleBuffer: sb)
                }
            }
            tapInstalled = true

            engine.prepare()
            try engine.start()
        }

        func stop() {
            if tapInstalled {
                engine.inputNode.removeTap(onBus: 0)
                tapInstalled = false
            }
            if engine.isRunning { engine.stop() }
        }
    }

#endif
