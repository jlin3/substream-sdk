// SubstreamConfig.swift
// Public configuration object for `Substream.startStream(_:)`.
//
// Mirrors the `SubstreamConfig` interface in `packages/web-sdk/src/index.ts`
// so developers can move between web + iOS with the same mental model.

import Foundation

#if canImport(UIKit)
    import UIKit
#endif
#if canImport(MetalKit)
    import MetalKit
#endif
#if canImport(SpriteKit)
    import SpriteKit
#endif
#if canImport(SceneKit)
    import SceneKit
#endif
#if canImport(QuartzCore)
    import QuartzCore
#endif

/// Configuration for a Substream streaming session.
public struct SubstreamConfig: Sendable {

    // MARK: Required

    /// Backend API URL — the host of your Substream platform.
    ///
    /// Example: `URL(string: "https://substream-sdk-production.up.railway.app")!`
    public var backendUrl: URL

    /// Auth token for the backend. Accepts either an `sk_live_…` API key
    /// or a JWT issued by your own auth system.
    public var authToken: String

    /// Player/streamer identifier from your auth system.
    ///
    /// Shown on the dashboard and used as the webhook payload's `streamerId`.
    public var streamerId: String

    /// Capture source — what gets streamed.
    public var capture: CaptureSource

    // MARK: Optional

    /// Organization ID — associates the stream with an org on the dashboard.
    public var orgId: String?

    /// Display name for the streamer (appears on the viewer page + dashboard).
    public var streamerName: String?

    /// Stream title shown to viewers (e.g. `"Level 3 speedrun"`).
    public var title: String?

    /// Target frame rate for the outgoing video. Default: `30`.
    public var fps: Int

    /// Target video bitrate in kbps. Default: `2500` (matches WHIP constraints).
    public var videoBitrateKbps: Int

    /// Include audio in the outgoing stream. Default: `true`.
    public var audio: Bool

    /// Audio source when `audio == true`. Default: `.gameAudioEngine(nil)` which
    /// auto-detects `AVAudioEngine.mainMixerNode`, otherwise falls back to the mic.
    public var audioSource: AudioSource

    /// Automatically downscale + drop fps under thermal pressure. Default: `true`.
    public var adaptiveQuality: Bool

    // MARK: Init

    public init(
        backendUrl: URL,
        authToken: String,
        streamerId: String,
        capture: CaptureSource,
        orgId: String? = nil,
        streamerName: String? = nil,
        title: String? = nil,
        fps: Int = 30,
        videoBitrateKbps: Int = 2500,
        audio: Bool = true,
        audioSource: AudioSource = .auto,
        adaptiveQuality: Bool = true
    ) {
        self.backendUrl = backendUrl
        self.authToken = authToken
        self.streamerId = streamerId
        self.capture = capture
        self.orgId = orgId
        self.streamerName = streamerName
        self.title = title
        self.fps = fps
        self.videoBitrateKbps = videoBitrateKbps
        self.audio = audio
        self.audioSource = audioSource
        self.adaptiveQuality = adaptiveQuality
    }

    // MARK: Validation

    /// Lightweight client-side validation — fail fast before we hit the network.
    func validate() throws {
        guard !authToken.isEmpty else {
            throw SubstreamError.invalidConfig("authToken is required")
        }
        guard !streamerId.isEmpty else {
            throw SubstreamError.invalidConfig("streamerId is required")
        }
        guard fps > 0 && fps <= 60 else {
            throw SubstreamError.invalidConfig("fps must be 1…60 (got \(fps))")
        }
        guard videoBitrateKbps >= 300 && videoBitrateKbps <= 10_000 else {
            throw SubstreamError.invalidConfig(
                "videoBitrateKbps must be 300…10000 (got \(videoBitrateKbps))"
            )
        }
    }
}

// MARK: - CaptureSource

/// Describes what the SDK should capture.
///
/// Only one case is `Sendable`-escaping-safe because it carries a UIView ref;
/// the SDK immediately hops to `@MainActor` to consume the view on start.
public enum CaptureSource: @unchecked Sendable {

    /// Capture an `MTKView`'s rendered content.
    #if canImport(MetalKit)
        case metalView(MTKView)
    #endif

    /// Capture a raw `CAMetalLayer` (for engines that manage their own view).
    #if canImport(QuartzCore)
        case metalLayer(CAMetalLayer)
    #endif

    /// Capture a SpriteKit `SKView`.
    #if canImport(SpriteKit) && canImport(UIKit)
        case spriteKit(SKView)
    #endif

    /// Capture a SceneKit `SCNView`.
    #if canImport(SceneKit) && canImport(UIKit)
        case sceneKit(SCNView)
    #endif

    /// Generic `UIView` fallback (slowest — uses `UIGraphicsImageRenderer`).
    #if canImport(UIKit)
        case uiView(UIView)
    #endif

    /// In-app ReplayKit capture via `RPScreenRecorder.startCapture(handler:)`.
    /// Requires user permission; only runs while the app is foregrounded.
    #if canImport(ReplayKit) && canImport(UIKit)
        case replayKit
    #endif

    /// System-wide capture via a Broadcast Upload Extension. Pass the App Group
    /// identifier shared between your app and the extension target.
    ///
    /// See `Sources/SubstreamSDK/BroadcastExtension/README.md`.
    #if canImport(ReplayKit) && canImport(UIKit)
        case broadcastExtension(appGroup: String)
    #endif
}

// MARK: - AudioSource

/// Describes how the SDK should obtain audio samples.
public enum AudioSource: @unchecked Sendable {
    /// Best-effort auto-detect. Prefers `AVAudioEngine.mainMixerNode` if the
    /// host app exposes one, otherwise falls back to the microphone.
    case auto

    /// Tap a specific `AVAudioEngine`'s main mixer. Non-destructive.
    #if canImport(AVFoundation)
        case gameAudioEngine(AVAudioEngineRef)
    #endif

    /// Microphone input via `AVAudioSession.category = .playAndRecord`.
    case microphone

    /// No audio (video only).
    case none

    /// ReplayKit-sourced audio (app + optional mic). Only valid with `.replayKit`
    /// or `.broadcastExtension` capture sources — the SDK wires this up automatically.
    case replayKit
}

/// Type-erased reference to `AVAudioEngine` to keep SubstreamConfig Sendable-friendly.
/// `AVAudioEngine` is a reference type that lives on the host app's queue.
#if canImport(AVFoundation)
    import AVFoundation
    public struct AVAudioEngineRef: @unchecked Sendable {
        public let engine: AVAudioEngine
        public init(_ engine: AVAudioEngine) { self.engine = engine }
    }
#endif
