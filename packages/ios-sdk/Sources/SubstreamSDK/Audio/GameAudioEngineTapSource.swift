// GameAudioEngineTapSource.swift
// Taps the host app's `AVAudioEngine.mainMixerNode` non-destructively — the
// game keeps playing audio through the speakers while we receive a copy of
// every buffer to forward to IVS. Mirrors the web SDK's `AudioNode` tee trick.

#if canImport(AVFoundation)

    import AVFoundation
    import CoreMedia
    import Foundation

    final class GameAudioEngineTapSource: SubstreamAudioSource {

        private let engine: AVAudioEngine
        private weak var sink: SubstreamAudioSink?
        private var tapInstalled = false
        private var clockStart: CMTime = .zero
        private var samplesSent: Int64 = 0

        init(engine: AVAudioEngine) {
            self.engine = engine
        }

        func attach(sink: SubstreamAudioSink) { self.sink = sink }

        func start() throws {
            let node = engine.mainMixerNode
            let format = node.outputFormat(forBus: 0)

            node.installTap(onBus: 0, bufferSize: 1024, format: format) {
                [weak self] buffer, time in
                guard let self, let sink = self.sink else { return }
                let sampleRate = buffer.format.sampleRate
                let pts = CMTime(
                    value: self.samplesSent,
                    timescale: CMTimeScale(sampleRate)
                )
                self.samplesSent += Int64(buffer.frameLength)

                if let sb = AudioFormatHelpers.sampleBuffer(from: buffer, pts: pts) {
                    sink.consume(sampleBuffer: sb)
                }
            }
            tapInstalled = true

            if !engine.isRunning {
                try engine.start()
            }
        }

        func stop() {
            if tapInstalled {
                engine.mainMixerNode.removeTap(onBus: 0)
                tapInstalled = false
            }
        }
    }

#endif
