// Substream.swift
// SubstreamSDK — public facade.
//
// Mirrors the `@substream/web-sdk` JavaScript API:
//   - SubstreamSDK.startStream(config) / session.stop()
//   - same `/api/streams/web-publish` backend contract
//
// Design goals:
//   - 5-line hello-world
//   - async/await only on the public surface
//   - typed errors (SubstreamError)
//   - AsyncStream of lifecycle events for UI binding
//   - no global mutable state; each call returns an owned SubstreamSession

import Foundation

/// Top-level namespace + entry points for the SDK.
///
/// ```swift
/// let session = try await Substream.startStream(
///     .init(
///         backendUrl: URL(string: "https://api.substream.dev")!,
///         authToken: "sk_live_…",
///         streamerId: "player-456",
///         capture: .metalView(gameView)
///     )
/// )
/// print("Live:", session.viewerUrl)
/// // …later
/// await session.stop()
/// ```
public enum Substream {

    /// Semantic version of the SDK, surfaced to the backend as `X-Substream-SDK`.
    public static let sdkVersion = "1.0.0"

    /// Platform identifier sent to the backend so dashboards can segment iOS streams.
    public static let sdkPlatform = "ios"

    /// Start a live stream.
    ///
    /// This performs the full boot sequence:
    ///   1. `POST /api/streams/web-publish` to mint an IVS participant token.
    ///   2. Build the requested capture + audio sources.
    ///   3. Join the IVS Real-Time stage via `AmazonIVSBroadcast`.
    ///   4. Return a live `SubstreamSession` that emits events and exposes `stop()`.
    ///
    /// - Throws: `SubstreamError` on any failure (auth, network, capture, IVS).
    public static func startStream(_ config: SubstreamConfig) async throws -> SubstreamSession {
        try config.validate()

        let client = SubstreamClient(config: config)
        return try await client.start()
    }
}
