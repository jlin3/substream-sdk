// FrameStats.swift
// Tiny rolling counter for frames-per-second / dropped-frames. Each capture
// source calls `markDelivered()` per successful frame and `markDropped()`
// when the pool returns nil.

import Foundation
import QuartzCore

final class FrameStats: @unchecked Sendable {

    private let lock = NSLock()
    private var deliveredTimestamps: [CFTimeInterval] = []
    private var droppedInWindow: Int = 0

    /// Rolling window in seconds.
    let window: CFTimeInterval

    init(window: CFTimeInterval = 1.0) {
        self.window = window
    }

    func markDelivered() {
        let now = CACurrentMediaTime()
        lock.lock()
        deliveredTimestamps.append(now)
        prune(now: now)
        lock.unlock()
    }

    func markDropped() {
        lock.lock()
        droppedInWindow += 1
        lock.unlock()
    }

    /// Frames delivered in the last `window` seconds.
    var fps: Int {
        let now = CACurrentMediaTime()
        lock.lock()
        defer { lock.unlock() }
        prune(now: now)
        return deliveredTimestamps.count
    }

    var droppedFrames: Int {
        lock.lock()
        defer { lock.unlock() }
        return droppedInWindow
    }

    func resetDroppedCounter() {
        lock.lock()
        droppedInWindow = 0
        lock.unlock()
    }

    private func prune(now: CFTimeInterval) {
        let cutoff = now - window
        while let first = deliveredTimestamps.first, first < cutoff {
            deliveredTimestamps.removeFirst()
        }
    }
}
