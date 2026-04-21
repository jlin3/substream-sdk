// UIViewCaptureSource.swift
// Generic UIView fallback. Uses `UIGraphicsImageRenderer` each display tick.
// Slower than Metal-based paths, but works with any view tree.

#if canImport(UIKit)

    import CoreMedia
    import CoreVideo
    import Foundation
    import UIKit

    final class UIViewCaptureSource: NSObject, SubstreamImageSource {

        var targetFps: Int {
            didSet { pacer.targetFps = targetFps }
        }

        private weak var view: UIView?
        private weak var sink: SubstreamImageSink?
        private let pacer: DisplayLinkPacer
        private let pool: PixelBufferPool

        init(view: UIView, targetFps: Int) {
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
                throw SubstreamError.captureUnavailable("UIView was deallocated")
            }
            pacer.start { [weak self] in self?.capture() }
        }

        func stop() { pacer.stop() }

        private func capture() {
            guard let view = view else { return }
            let bounds = view.bounds
            let scale = UIScreen.main.scale
            let w = max(16, Int(bounds.width * scale))
            let h = max(16, Int(bounds.height * scale))
            pool.resize(width: w, height: h)

            guard let dst = pool.dequeue() else { return }
            CVPixelBufferLockBaseAddress(dst, [])
            defer { CVPixelBufferUnlockBaseAddress(dst, []) }

            guard let base = CVPixelBufferGetBaseAddress(dst) else { return }
            let bitmapInfo = CGBitmapInfo.byteOrder32Little.rawValue
                | CGImageAlphaInfo.premultipliedFirst.rawValue
            guard
                let ctx = CGContext(
                    data: base,
                    width: CVPixelBufferGetWidth(dst),
                    height: CVPixelBufferGetHeight(dst),
                    bitsPerComponent: 8,
                    bytesPerRow: CVPixelBufferGetBytesPerRow(dst),
                    space: CGColorSpaceCreateDeviceRGB(),
                    bitmapInfo: bitmapInfo
                )
            else { return }
            ctx.scaleBy(x: scale, y: scale)
            view.layer.render(in: ctx)

            let pts = CMTime(value: Int64(CACurrentMediaTime() * 1_000_000), timescale: 1_000_000)
            sink?.consume(pixelBuffer: dst, presentationTime: pts)
        }
    }

#endif
