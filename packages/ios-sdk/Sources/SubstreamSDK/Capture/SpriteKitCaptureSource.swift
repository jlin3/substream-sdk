// SpriteKitCaptureSource.swift
// Captures an `SKView`'s scene at the target fps via `SKView.texture(from:)`,
// then renders the MTLTexture (wrapped as an SKTexture) into a pool pixel buffer.
//
// SpriteKit doesn't hand us the rendered drawable, so this path is CPU-ish:
// we snapshot the view's underlying `CALayer` tree into a CGImage, then copy
// into a pooled BGRA pixel buffer. Still fine at 60fps on modern devices.

#if canImport(SpriteKit) && canImport(UIKit)

    import CoreMedia
    import CoreVideo
    import Foundation
    import SpriteKit
    import UIKit

    final class SpriteKitCaptureSource: NSObject, SubstreamImageSource {

        var targetFps: Int {
            didSet { pacer.targetFps = targetFps }
        }

        private weak var view: SKView?
        private weak var sink: SubstreamImageSink?
        private let pacer: DisplayLinkPacer
        private let pool: PixelBufferPool
        private let captureQueue = DispatchQueue(label: "substream.capture.spritekit", qos: .userInteractive)

        init(view: SKView, targetFps: Int) {
            self.view = view
            self.targetFps = targetFps
            self.pacer = DisplayLinkPacer(targetFps: targetFps)
            let size = view.bounds.size
            self.pool = PixelBufferPool(
                width: max(16, Int(size.width * UIScreen.main.scale)),
                height: max(16, Int(size.height * UIScreen.main.scale))
            )
            super.init()
        }

        func attach(sink: SubstreamImageSink) { self.sink = sink }

        func start() throws {
            guard view != nil else {
                throw SubstreamError.captureUnavailable("SKView was deallocated")
            }
            pacer.start { [weak self] in self?.capture() }
        }

        func stop() { pacer.stop() }

        private func capture() {
            guard let view = view else { return }
            let bounds = view.bounds
            let scale = UIScreen.main.scale
            pool.resize(
                width: max(16, Int(bounds.width * scale)),
                height: max(16, Int(bounds.height * scale))
            )

            guard let dst = pool.dequeue() else { return }
            let pts = CMTime(value: Int64(CACurrentMediaTime() * 1_000_000), timescale: 1_000_000)

            // Render the view's layer tree into the pool buffer's backing store.
            CVPixelBufferLockBaseAddress(dst, [])
            defer { CVPixelBufferUnlockBaseAddress(dst, []) }

            let width = CVPixelBufferGetWidth(dst)
            let height = CVPixelBufferGetHeight(dst)
            let bytesPerRow = CVPixelBufferGetBytesPerRow(dst)
            guard let base = CVPixelBufferGetBaseAddress(dst) else { return }

            let colorSpace = CGColorSpaceCreateDeviceRGB()
            let bitmapInfo =
                CGBitmapInfo.byteOrder32Little.rawValue
                | CGImageAlphaInfo.premultipliedFirst.rawValue
            guard
                let ctx = CGContext(
                    data: base,
                    width: width,
                    height: height,
                    bitsPerComponent: 8,
                    bytesPerRow: bytesPerRow,
                    space: colorSpace,
                    bitmapInfo: bitmapInfo
                )
            else { return }

            ctx.scaleBy(x: scale, y: scale)
            view.layer.render(in: ctx)

            captureQueue.async { [weak self] in
                self?.sink?.consume(pixelBuffer: dst, presentationTime: pts)
            }
        }
    }

#endif
