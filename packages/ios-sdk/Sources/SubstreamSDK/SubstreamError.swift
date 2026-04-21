// SubstreamError.swift
// Typed error surface. All public throws are `SubstreamError`.

import Foundation

/// Every error the SDK can throw to a caller.
public enum SubstreamError: Error, Sendable, CustomStringConvertible {

    /// The `SubstreamConfig` was invalid (missing fields, out-of-range fps, etc.).
    case invalidConfig(String)

    /// The backend rejected the auth token (401 / 403).
    case auth(String)

    /// The backend returned a non-success HTTP status.
    case network(status: Int, message: String)

    /// A local network failure (no route, timeout).
    case transport(underlying: Error)

    /// The requested capture source isn't available (e.g. ReplayKit permission denied).
    case captureUnavailable(String)

    /// The AmazonIVSBroadcast SDK reported an error.
    case ivs(String)

    /// `startStream` was called on an SDK client that is already running.
    case alreadyStreaming

    /// The user or SDK cancelled the operation.
    case cancelled

    /// Catch-all for internal invariant violations.
    case internalError(String)

    public var description: String {
        switch self {
        case .invalidConfig(let m): return "SubstreamSDK: invalid config — \(m)"
        case .auth(let m): return "SubstreamSDK: auth failed — \(m)"
        case .network(let code, let m): return "SubstreamSDK: HTTP \(code) — \(m)"
        case .transport(let e): return "SubstreamSDK: transport error — \(e.localizedDescription)"
        case .captureUnavailable(let m): return "SubstreamSDK: capture unavailable — \(m)"
        case .ivs(let m): return "SubstreamSDK: IVS error — \(m)"
        case .alreadyStreaming: return "SubstreamSDK: already streaming"
        case .cancelled: return "SubstreamSDK: cancelled"
        case .internalError(let m): return "SubstreamSDK: internal error — \(m)"
        }
    }
}

extension SubstreamError: LocalizedError {
    public var errorDescription: String? { description }
}
