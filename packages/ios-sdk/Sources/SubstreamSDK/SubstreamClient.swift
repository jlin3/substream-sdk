// SubstreamClient.swift
// Orchestrates the full streaming lifecycle:
//
//   1. Call the backend (`PublishAPI`) to mint a participant token.
//   2. Build the capture + audio sources.
//   3. Join the IVS Real-Time stage via AmazonIVSBroadcast.
//   4. Pump frames/audio into IVSCustomImageSource / IVSCustomAudioSource.
//   5. Emit events, heartbeats, stats, reconnects.
//   6. Tear everything down on `stop()`.
//
// One `SubstreamClient` = one `SubstreamSession`.

import CoreMedia
import CoreVideo
import Foundation

#if canImport(UIKit)
    import UIKit
#endif
#if canImport(AVFoundation)
    import AVFoundation
#endif
#if canImport(AmazonIVSBroadcast)
    import AmazonIVSBroadcast
#endif

/// Internal orchestrator, owned by `SubstreamSession`.
final class SubstreamClient: @unchecked Sendable {

    // MARK: Inputs

    private let config: SubstreamConfig
    private let publishAPI: PublishAPI

    // MARK: State

    /// Serializes lifecycle transitions so `start`/`stop`/reconnect can't race.
    private let lifecycleQueue = DispatchQueue(label: "substream.client.lifecycle")
    private var isRunning = false
    private var isStopping = false

    /// Emits lifecycle events to the session's AsyncStream.
    private weak var session: SubstreamSession?

    private var currentSession: SubstreamSession?
    private var imageSource: (any SubstreamImageSource)?
    private var audioSrc: (any SubstreamAudioSource)?
    private var heartbeatTask: Task<Void, Never>?
    private var statsTask: Task<Void, Never>?
    private var backgroundObserver: NSObjectProtocol?
    private var foregroundObserver: NSObjectProtocol?
    private var audioMuted = false
    private var adaptiveQualityEnabled: Bool
    private let frameStats = FrameStats()
    private let adaptive: AdaptiveQualityController

    #if canImport(AmazonIVSBroadcast)
        private var ivsStage: IVSStage?
        private var ivsImageDevice: IVSCustomImageSource?
        private var ivsAudioDevice: IVSCustomAudioSource?
        private var ivsStrategy: SubstreamStageStrategy?
    #endif

    // MARK: Init

    init(config: SubstreamConfig) {
        self.config = config
        self.publishAPI = PublishAPI(backendUrl: config.backendUrl, authToken: config.authToken)
        self.adaptiveQualityEnabled = config.adaptiveQuality
        self.adaptive = AdaptiveQualityController(
            baseFps: config.fps,
            baseBitrateKbps: config.videoBitrateKbps
        )
    }

    // MARK: - Lifecycle

    /// Boot sequence. Returns a live session.
    @MainActor
    func start() async throws -> SubstreamSession {
        try lifecycleQueue.sync {
            guard !isRunning else { throw SubstreamError.alreadyStreaming }
            isRunning = true
        }

        Log.info("Starting stream (sdk=\(Substream.sdkVersion), platform=\(Substream.sdkPlatform))")

        // 1. Request publish token from backend
        let response: PublishResponse
        do {
            response = try await publishAPI.requestPublishToken(
                PublishRequest(
                    streamerId: config.streamerId,
                    orgId: config.orgId,
                    streamerName: config.streamerName,
                    title: config.title,
                    platform: Substream.sdkPlatform,
                    sdkVersion: Substream.sdkVersion
                )
            )
        } catch {
            lifecycleQueue.sync { isRunning = false }
            throw error
        }
        Log.info("Got publish token: streamId=\(response.streamId)")

        guard let viewerUrl = URL(string: response.viewerUrl) else {
            lifecycleQueue.sync { isRunning = false }
            throw SubstreamError.internalError("Backend returned invalid viewerUrl")
        }

        // 2. Build session + emit connecting
        let sess = SubstreamSession(streamId: response.streamId, viewerUrl: viewerUrl, client: self)
        self.session = sess
        self.currentSession = sess
        sess.eventChannel.emit(.connecting)

        // 3. Configure AVAudioSession if we're going to capture audio
        if config.audio {
            configureAudioSession()
        }

        // 4. Build capture + audio sources and wire to IVS devices
        do {
            try await bootPipeline(publishToken: response.publishToken)
        } catch {
            await teardown(reason: .error(mapError(error)))
            throw error
        }

        // 5. Install foreground/background observers
        installLifecycleObservers()

        // 6. Kick off heartbeat + stats
        startHeartbeat(sessionId: response.streamId)
        startStatsLoop()

        return sess
    }

    /// Tear the session down. Safe to call multiple times.
    func stop() async {
        lifecycleQueue.sync {
            guard isRunning, !isStopping else { return }
            isStopping = true
        }
        await teardown(reason: .userRequested)
    }

    // MARK: - Runtime toggles

    func setAudioMuted(_ muted: Bool) {
        audioMuted = muted
        #if canImport(AmazonIVSBroadcast)
            ivsAudioDevice?.setGain(muted ? 0.0 : 1.0)
        #endif
    }

    func setAdaptiveQuality(_ enabled: Bool) {
        adaptiveQualityEnabled = enabled
    }

    // MARK: - Pipeline

    @MainActor
    private func bootPipeline(publishToken: String) async throws {
        // Build the capture source
        let source = try buildImageSource()
        self.imageSource = source

        // Build the audio source if audio is enabled
        let audioSource: (any SubstreamAudioSource)?
        if config.audio {
            audioSource = try buildAudioSource()
        } else {
            audioSource = nil
        }
        self.audioSrc = audioSource

        #if canImport(AmazonIVSBroadcast)
            // Create IVS custom devices
            let ivsImage = IVSCustomImageSource()
            ivsImage.setName("substream-video")
            self.ivsImageDevice = ivsImage

            let ivsAudio: IVSCustomAudioSource?
            if audioSource != nil {
                let a = IVSCustomAudioSource()
                a.setName("substream-audio")
                ivsAudio = a
            } else {
                ivsAudio = nil
            }
            self.ivsAudioDevice = ivsAudio

            // Bridge capture → IVS, with a frame-stats trampoline.
            let imageAdapter = IVSImageSinkAdapter(device: ivsImage, stats: frameStats)
            source.attach(sink: imageAdapter)
            if let audioSource, let ivsAudio {
                audioSource.attach(sink: IVSAudioSinkAdapter(device: ivsAudio))
            }

            // If we built a ReplayKit source, wire it to the broadcast bridge
            // so a Broadcast Upload Extension (or in-app ReplayKit) can push frames.
            #if canImport(ReplayKit) && canImport(UIKit)
                if let rk = source as? ReplayKitInAppSource {
                    SubstreamBroadcastBridge.shared.imageSource = rk
                }
            #endif
            if let rkAudio = audioSource as? ReplayKitAudioSource {
                SubstreamBroadcastBridge.shared.audioSource = rkAudio
            }

            // Start capture before joining so the first frame is ready
            try source.start()
            try audioSource?.start()

            // Build strategy + stage and join
            let strategy = SubstreamStageStrategy(videoDevice: ivsImage, audioDevice: ivsAudio)
            self.ivsStrategy = strategy

            let stage: IVSStage
            do {
                stage = try IVSStage(token: publishToken, strategy: strategy)
            } catch {
                throw SubstreamError.ivs("IVSStage init failed: \(error.localizedDescription)")
            }
            stage.errorDelegate = IVSStageErrorProxy(client: self)
            stage.renderer = nil
            self.ivsStage = stage

            do {
                try stage.join()
            } catch {
                throw SubstreamError.ivs("IVSStage.join failed: \(error.localizedDescription)")
            }

            session?.setLive(true)
            session?.eventChannel.emit(
                .live(
                    info: .init(
                        streamId: self.currentSession?.streamId ?? "",
                        viewerUrl: self.currentSession?.viewerUrl ?? config.backendUrl
                    )
                )
            )
        #else
            // Without the IVS dependency, we still start capture for simulators/tests.
            source.attach(sink: StubImageSink(stats: frameStats))
            #if canImport(ReplayKit) && canImport(UIKit)
                if let rk = source as? ReplayKitInAppSource {
                    SubstreamBroadcastBridge.shared.imageSource = rk
                }
            #endif
            try source.start()
            try audioSource?.start()
            session?.setLive(true)
            session?.eventChannel.emit(
                .live(
                    info: .init(
                        streamId: self.currentSession?.streamId ?? "",
                        viewerUrl: self.currentSession?.viewerUrl ?? config.backendUrl
                    )
                )
            )
            session?.eventChannel.emit(
                .warning("AmazonIVSBroadcast not linked; frames are captured but not published.")
            )
        #endif
    }

    private func buildImageSource() throws -> any SubstreamImageSource {
        // The concrete types live in `Capture/`. Factory hides the #if canImport dance.
        return try CaptureSourceFactory.makeImageSource(for: config.capture, targetFps: config.fps)
    }

    private func buildAudioSource() throws -> any SubstreamAudioSource {
        return try CaptureSourceFactory.makeAudioSource(for: config.audioSource, capture: config.capture)
    }

    // MARK: - Audio session

    private func configureAudioSession() {
        #if canImport(AVFoundation) && canImport(UIKit)
            let session = AVAudioSession.sharedInstance()
            do {
                try session.setCategory(
                    .playAndRecord,
                    mode: .default,
                    options: [.mixWithOthers, .defaultToSpeaker, .allowBluetooth]
                )
                try session.setActive(true, options: [])
            } catch {
                Log.warn("AVAudioSession setup failed: \(error)")
            }
        #endif
    }

    // MARK: - Heartbeat

    private func startHeartbeat(sessionId: String) {
        heartbeatTask?.cancel()
        heartbeatTask = Task { [weak self] in
            while !Task.isCancelled {
                try? await Task.sleep(nanoseconds: 30_000_000_000) // 30s
                guard let self, !Task.isCancelled else { return }
                let bitrate = config.videoBitrateKbps
                await self.publishAPI.heartbeat(
                    sessionId: sessionId,
                    bitrateKbps: bitrate,
                    health: "healthy"
                )
            }
        }
    }

    private func startStatsLoop() {
        statsTask?.cancel()
        statsTask = Task { [weak self] in
            while !Task.isCancelled {
                try? await Task.sleep(nanoseconds: 1_000_000_000)
                guard let self, !Task.isCancelled else { return }
                let stats = self.currentStats()
                self.session?.eventChannel.emit(.statsUpdated(stats))
                self.adaptIfNeeded()
            }
        }
    }

    private func currentStats() -> SubstreamEvent.Stats {
        let thermal = ProcessInfo.processInfo.thermalState
        let dropped = frameStats.droppedFrames
        let fps = frameStats.fps

        // Health is the worst of: thermal state, drop rate, fps hitting target.
        let health: SubstreamEvent.Health
        let targetFps = adaptive.current.fps
        let fpsRatio = Double(fps) / Double(max(1, targetFps))
        if thermal == .critical || dropped > 10 || fpsRatio < 0.5 {
            health = .poor
        } else if thermal == .serious || dropped > 2 || fpsRatio < 0.8 {
            health = .degraded
        } else {
            health = .healthy
        }

        frameStats.resetDroppedCounter()

        return .init(
            bitrateKbps: adaptive.current.bitrateKbps,
            fps: fps,
            rttMs: 0, // IVS basic SDK doesn't surface RTT; filled in when stats delegate lands.
            droppedFrames: dropped,
            health: health
        )
    }

    private func adaptIfNeeded() {
        guard adaptiveQualityEnabled else { return }
        if adaptive.tick() {
            let target = adaptive.current
            imageSource?.targetFps = target.fps
            session?.eventChannel.emit(
                .warning(
                    "Adaptive quality: fps=\(target.fps) bitrate=\(target.bitrateKbps)kbps (\(target.reason))"
                )
            )
            #if canImport(AmazonIVSBroadcast)
                // IVS simulcast layer selection could go here in a future pass.
            #endif
        }
    }

    // MARK: - Lifecycle observers

    private func installLifecycleObservers() {
        #if canImport(UIKit)
            let nc = NotificationCenter.default
            backgroundObserver = nc.addObserver(
                forName: UIApplication.didEnterBackgroundNotification,
                object: nil,
                queue: .main
            ) { [weak self] _ in
                Log.info("App backgrounded; pausing capture")
                self?.imageSource?.stop()
            }
            foregroundObserver = nc.addObserver(
                forName: UIApplication.willEnterForegroundNotification,
                object: nil,
                queue: .main
            ) { [weak self] _ in
                Log.info("App foregrounded; resuming capture")
                try? self?.imageSource?.start()
            }
        #endif
    }

    private func removeLifecycleObservers() {
        #if canImport(UIKit)
            let nc = NotificationCenter.default
            if let o = backgroundObserver { nc.removeObserver(o) }
            if let o = foregroundObserver { nc.removeObserver(o) }
            backgroundObserver = nil
            foregroundObserver = nil
        #endif
    }

    // MARK: - Teardown

    private func teardown(reason: SubstreamEvent.StopReason) async {
        removeLifecycleObservers()

        heartbeatTask?.cancel()
        heartbeatTask = nil
        statsTask?.cancel()
        statsTask = nil

        imageSource?.stop()
        audioSrc?.stop()
        imageSource = nil
        audioSrc = nil

        #if canImport(AmazonIVSBroadcast)
            ivsStage?.leave()
            ivsStage = nil
            ivsImageDevice = nil
            ivsAudioDevice = nil
            ivsStrategy = nil
        #endif

        if let streamId = currentSession?.streamId {
            await publishAPI.releaseStream(streamId: streamId)
        }

        session?.setLive(false)
        session?.eventChannel.emit(.stopped(reason: reason))
        session?.eventChannel.finish()

        lifecycleQueue.sync {
            isRunning = false
            isStopping = false
        }
        currentSession = nil
    }

    // MARK: - Reconnect

    /// Called by the IVS error delegate when the stage disconnects unexpectedly.
    func handleStageError(_ error: Error) {
        Log.warn("IVS stage error: \(error)")
        Task { [weak self] in
            guard let self else { return }
            // We don't auto-reconnect by re-requesting a publish token here;
            // IVSStage handles transient ICE reconnects. If the state stays
            // errored past a grace period, we tear down. The full reconnect
            // (re-fetch participant token + re-join) lives in the resilience task.
            self.session?.eventChannel.emit(.reconnecting(attempt: 1))
        }
    }

    private func mapError(_ error: Error) -> SubstreamError {
        if let e = error as? SubstreamError { return e }
        return .internalError(error.localizedDescription)
    }
}

// MARK: - IVS adapter types
// These bridge the internal `SubstreamImageSink`/`SubstreamAudioSink` protocols
// to the IVS custom devices, so capture sources don't need to `import AmazonIVSBroadcast`.

/// No-IVS fallback sink (used in simulator / tests when the binary target is absent).
final class StubImageSink: SubstreamImageSink {
    private let stats: FrameStats
    init(stats: FrameStats) { self.stats = stats }
    func consume(pixelBuffer: CVPixelBuffer, presentationTime: CMTime) {
        stats.markDelivered()
    }
}

#if canImport(AmazonIVSBroadcast)

    final class IVSImageSinkAdapter: SubstreamImageSink {
        private let device: IVSCustomImageSource
        private let stats: FrameStats
        init(device: IVSCustomImageSource, stats: FrameStats) {
            self.device = device
            self.stats = stats
        }
        func consume(pixelBuffer: CVPixelBuffer, presentationTime: CMTime) {
            device.onSampleBuffer(SubstreamSampleBufferBuilder.make(pixelBuffer: pixelBuffer, pts: presentationTime))
            stats.markDelivered()
        }
    }

    final class IVSAudioSinkAdapter: SubstreamAudioSink {
        private let device: IVSCustomAudioSource
        init(device: IVSCustomAudioSource) { self.device = device }
        func consume(sampleBuffer: CMSampleBuffer) {
            device.onSampleBuffer(sampleBuffer)
        }
    }

    /// Proxy that forwards IVS errors to the owning client.
    final class IVSStageErrorProxy: NSObject, IVSErrorDelegate {
        weak var client: SubstreamClient?
        init(client: SubstreamClient) {
            self.client = client
            super.init()
        }
        func source(_ source: IVSErrorSource, didEmitError error: Error) {
            client?.handleStageError(error)
        }
    }
#endif
