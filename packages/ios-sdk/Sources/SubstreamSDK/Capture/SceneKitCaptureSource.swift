// SceneKitCaptureSource.swift
// Captures an `SCNView` by calling `snapshot()` at the target fps. `snapshot()`
// returns a `UIImage`; we render it into a pool pixel buffer.

#if canImport(SceneKit) && canImport(UIKit)

    import CoreMedia
    import CoreVideo
    import Foundation
    import SceneKit
    import UIKit

    final class SceneKitCaptureSource: NSObject, SubstreamImageSource {

        var targetFps: Int {
            didSet { pacer.targetFps = targetFps }
        }

        private weak var view: SCNView?
        private weak var sink: SubstreamImageSink?
        private let pacer: DisplayLinkPacer
        private let pool: PixelBufferPool

        init(view: SCNView, targetFps: Int) {
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
                throw SubstreamError.captureUnavailable("SCNView was deallocated")
            }
            pacer.start { [weak self] in self?.capture() }
        }

        func stop() { pacer.stop() }

        private func capture() {
            guard let view = view else { return }
            let image = view.snapshot()

            let w = Int(image.size.width * image.scale)
            let h = Int(image.size.height * image.scale)
            pool.resize(width: max(16, w), height: max(16, h))

            guard let dst = pool.dequeue() else { return }
            CVPixelBufferLockBaseAddress(dst, [])
            defer { CVPixelBufferUnlockBaseAddress(dst, []) }

            let width = CVPixelBufferGetWidth(dst)
            let height = CVPixelBufferGetHeight(dst)
            let bytesPerRow = CVPixelBufferGetBytesPerRow(dst)
            guard let base = CVPixelBufferGetBaseAddress(dst),
                let cg = image.cgImage
            else { return }

            let bitmapInfo = CGBitmapInfo.byteOrder32Little.rawValue
                | CGImageAlphaInfo.premultipliedFirst.rawValue

            guard
                let ctx = CGContext(
                    data: base,
                    width: width,
                    height: height,
                    bitsPerComponent: 8,
                    bytesPerRow: bytesPerRow,
                    space: CGColorSpaceCreateDeviceRGB(),
                    bitmapInfo: bitmapInfo
                )
            else { return }

            ctx.draw(cg, in: CGRect(x: 0, y: 0, width: width, height: height))

            let pts = CMTime(value: Int64(CACurrentMediaTime() * 1_000_000), timescale: 1_000_000)
            sink?.consume(pixelBuffer: dst, presentationTime: pts)
        }
    }

#endif
