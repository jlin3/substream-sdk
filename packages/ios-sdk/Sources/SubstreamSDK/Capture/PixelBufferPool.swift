// PixelBufferPool.swift
// Thin wrapper around `CVPixelBufferPool` that enforces BGRA + IOSurface-backed
// buffers — required by both `AmazonIVSBroadcast` and hardware Metal paths.

import CoreVideo
import Foundation

final class PixelBufferPool {
    private(set) var width: Int
    private(set) var height: Int
    private var pool: CVPixelBufferPool?

    init(width: Int, height: Int) {
        self.width = width
        self.height = height
        rebuild()
    }

    func resize(width: Int, height: Int) {
        guard width != self.width || height != self.height else { return }
        self.width = width
        self.height = height
        rebuild()
    }

    /// Dequeue a buffer. Nil if the pool can't satisfy the request (memory
    /// pressure) — callers should simply drop the frame.
    func dequeue() -> CVPixelBuffer? {
        guard let pool else { return nil }
        var buf: CVPixelBuffer?
        let r = CVPixelBufferPoolCreatePixelBuffer(kCFAllocatorDefault, pool, &buf)
        return r == kCVReturnSuccess ? buf : nil
    }

    private func rebuild() {
        let attrs: [CFString: Any] = [
            kCVPixelBufferPixelFormatTypeKey: kCVPixelFormatType_32BGRA,
            kCVPixelBufferWidthKey: width,
            kCVPixelBufferHeightKey: height,
            kCVPixelBufferIOSurfacePropertiesKey: [:] as CFDictionary,
            kCVPixelBufferMetalCompatibilityKey: true,
        ]
        var pool: CVPixelBufferPool?
        CVPixelBufferPoolCreate(
            kCFAllocatorDefault,
            nil,
            attrs as CFDictionary,
            &pool
        )
        self.pool = pool
    }
}
