// Reconnector.swift
// Exponential-backoff reconnect driver.
//
// Used when the IVS stage drops to `.disconnected` / `.errored`. The SDK
// attempts re-join with a capped backoff; each attempt emits a
// `.reconnecting(attempt:)` event so the host app can update UI.

import Foundation

/// Retry a closure with exponential backoff.
struct Reconnector {
    /// Maximum number of attempts before giving up. `nil` = infinite.
    var maxAttempts: Int?
    /// Initial delay in seconds.
    var baseDelay: Double
    /// Cap on any single delay.
    var maxDelay: Double
    /// Multiplier per attempt. `2.0` = double each time.
    var multiplier: Double
    /// Jitter range, as a fraction of the computed delay (e.g. `0.1` = ±10%).
    var jitter: Double

    init(
        maxAttempts: Int? = 10,
        baseDelay: Double = 0.5,
        maxDelay: Double = 30.0,
        multiplier: Double = 2.0,
        jitter: Double = 0.2
    ) {
        self.maxAttempts = maxAttempts
        self.baseDelay = baseDelay
        self.maxDelay = maxDelay
        self.multiplier = multiplier
        self.jitter = jitter
    }

    /// Compute the delay for a 1-indexed attempt number.
    func delay(forAttempt attempt: Int) -> Double {
        let raw = min(maxDelay, baseDelay * pow(multiplier, Double(attempt - 1)))
        let jitterSpan = raw * jitter
        let jittered = raw + Double.random(in: -jitterSpan...jitterSpan)
        return max(0, jittered)
    }

    /// Run the reconnect loop. The `attempt` callback is invoked before each
    /// attempt with the 1-indexed number. Returns when `op` succeeds or we
    /// exhaust `maxAttempts`.
    func run(
        onAttempt: (Int) -> Void = { _ in },
        operation: () async throws -> Void
    ) async throws {
        var attempt = 1
        while true {
            onAttempt(attempt)
            do {
                try await operation()
                return
            } catch is CancellationError {
                throw SubstreamError.cancelled
            } catch {
                if let max = maxAttempts, attempt >= max {
                    throw error
                }
                try await Task.sleep(nanoseconds: UInt64(delay(forAttempt: attempt) * 1_000_000_000))
                attempt += 1
            }
        }
    }
}
