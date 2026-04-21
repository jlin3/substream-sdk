// SubstreamSession.swift
// Live-session handle returned by `Substream.startStream(_:)`.
//
// Exposes:
//   - streamId + viewerUrl (for deep-linking / sharing)
//   - events: AsyncStream<SubstreamEvent> for UI binding
//   - stop() async to tear down cleanly
//   - setMuted(_:) / setAdaptiveQuality(_:) runtime toggles

import Foundation

/// A live streaming session. Retain this for the duration of the stream;
/// calling `stop()` releases all resources and notifies the backend.
public final class SubstreamSession: @unchecked Sendable {

    /// Unique stream identifier (UUID string) from the backend.
    public let streamId: String

    /// URL viewers can open to watch the stream.
    public let viewerUrl: URL

    /// Lifecycle + stats events. Consume with `for await event in session.events { … }`.
    public var events: AsyncStream<SubstreamEvent> { eventChannel.stream }

    /// Whether the IVS stage is currently in the `.connected` state.
    public var isLive: Bool { stateQueue.sync { _isLive } }

    /// Mute/unmute outgoing audio at runtime without tearing down the stream.
    public func setMuted(_ muted: Bool) {
        client?.setAudioMuted(muted)
    }

    /// Toggle adaptive bitrate at runtime.
    public func setAdaptiveQuality(_ enabled: Bool) {
        client?.setAdaptiveQuality(enabled)
    }

    /// Stop the stream. Safe to call more than once; subsequent calls are no-ops.
    public func stop() async {
        await client?.stop()
    }

    // MARK: - Internal

    /// Weak-ish ownership: the client owns the session via a strong ref, and the
    /// session exposes commands back to the client through this captured reference.
    /// We `nil` it out on `stop()` to break the cycle.
    weak var client: SubstreamClient?

    let eventChannel: EventChannel

    private let stateQueue = DispatchQueue(label: "substream.session.state")
    private var _isLive: Bool = false

    init(streamId: String, viewerUrl: URL, client: SubstreamClient) {
        self.streamId = streamId
        self.viewerUrl = viewerUrl
        self.client = client
        self.eventChannel = EventChannel()
    }

    func setLive(_ live: Bool) {
        stateQueue.sync { _isLive = live }
    }
}

// MARK: - Events

/// Lifecycle + stats events emitted by a `SubstreamSession`.
public enum SubstreamEvent: Sendable {
    /// Allocating the IVS stage / joining.
    case connecting

    /// Stream is live. Payload includes the viewer URL.
    case live(info: LiveInfo)

    /// Connection dropped; SDK is trying to reconnect. `attempt` is 1-indexed.
    case reconnecting(attempt: Int)

    /// Stream stopped (either by `stop()` or an unrecoverable error).
    case stopped(reason: StopReason)

    /// Periodic stats update (once per second).
    case statsUpdated(Stats)

    /// Non-fatal warning (e.g. thermal throttle, ReplayKit audio dropped).
    case warning(String)

    public struct LiveInfo: Sendable {
        public let streamId: String
        public let viewerUrl: URL
    }

    public struct Stats: Sendable {
        public let bitrateKbps: Int
        public let fps: Int
        public let rttMs: Int
        public let droppedFrames: Int
        public let health: Health
    }

    public enum Health: String, Sendable { case healthy, degraded, poor }

    public enum StopReason: Sendable {
        case userRequested
        case networkLost
        case error(SubstreamError)
    }
}

// MARK: - EventChannel

/// Thread-safe bridge between internal emitters and the public `AsyncStream`.
///
/// `AsyncStream` itself handles multi-reader/backpressure, but we want a single
/// stable `.stream` property and a simple `.emit(_:)` call site.
final class EventChannel: @unchecked Sendable {
    let stream: AsyncStream<SubstreamEvent>
    private let continuation: AsyncStream<SubstreamEvent>.Continuation

    init() {
        var cont: AsyncStream<SubstreamEvent>.Continuation!
        self.stream = AsyncStream { c in cont = c }
        self.continuation = cont
    }

    func emit(_ event: SubstreamEvent) {
        continuation.yield(event)
    }

    func finish() {
        continuation.finish()
    }
}
