// MetalLayerCaptureSource.swift
// Captures any `CAMetalLayer`. Used when a game manages its own view/layer
// instead of using MTKView. Same blit approach as `MTKViewCaptureSource`,
// but we snapshot `layer.nextDrawable()`'s texture via a CADisplayLink tick.

#if canImport(QuartzCore)

    import CoreMedia
    import CoreVideo
    import Foundation
    import Metal
    import QuartzCore

    final class MetalLayerCaptureSource: NSObject, SubstreamImageSource {

        var targetFps: Int {
            didSet { pacer.targetFps = targetFps }
        }

        private weak var layer: CAMetalLayer?
        private weak var sink: SubstreamImageSink?

        private let device: MTLDevice
        private let commandQueue: MTLCommandQueue
        private let pacer: DisplayLinkPacer
        private let pool: PixelBufferPool
        private var textureCache: CVMetalTextureCache?

        init(layer: CAMetalLayer, targetFps: Int) {
            self.layer = layer
            self.targetFps = targetFps
            self.pacer = DisplayLinkPacer(targetFps: targetFps)

            let mtlDevice = layer.device ?? MTLCreateSystemDefaultDevice()
            guard let mtlDevice, let q = mtlDevice.makeCommandQueue() else {
                fatalError("SubstreamSDK: no Metal device available")
            }
            self.device = mtlDevice
            self.commandQueue = q

            let size = layer.drawableSize
            self.pool = PixelBufferPool(
                width: Int(size.width > 0 ? size.width : 1280),
                height: Int(size.height > 0 ? size.height : 720)
            )
            super.init()

            var cache: CVMetalTextureCache?
            CVMetalTextureCacheCreate(kCFAllocatorDefault, nil, mtlDevice, nil, &cache)
            self.textureCache = cache
        }

        func attach(sink: SubstreamImageSink) { self.sink = sink }

        func start() throws {
            guard layer != nil else {
                throw SubstreamError.captureUnavailable("CAMetalLayer was deallocated")
            }
            pacer.start { [weak self] in self?.capture() }
        }

        func stop() { pacer.stop() }

        // CAMetalLayer doesn't expose the currently-rendered drawable, so we can
        // only copy from textures the host has rendered this tick. We attempt
        // `nextDrawable()` non-destructively — if the host is mid-render we skip.
        private func capture() {
            guard let layer = layer,
                let drawable = layer.nextDrawable()
            else { return }

            let tex = drawable.texture
            let w = tex.width
            let h = tex.height
            pool.resize(width: w, height: h)

            guard
                let dst = pool.dequeue(),
                let cache = textureCache
            else { return }

            var mtlRef: CVMetalTexture?
            let status = CVMetalTextureCacheCreateTextureFromImage(
                kCFAllocatorDefault, cache, dst, nil, .bgra8Unorm, w, h, 0, &mtlRef
            )
            guard status == kCVReturnSuccess,
                let ref = mtlRef,
                let dstTex = CVMetalTextureGetTexture(ref),
                let cmd = commandQueue.makeCommandBuffer(),
                let blit = cmd.makeBlitCommandEncoder()
            else { return }

            blit.copy(
                from: tex,
                sourceSlice: 0,
                sourceLevel: 0,
                sourceOrigin: MTLOrigin(x: 0, y: 0, z: 0),
                sourceSize: MTLSize(width: w, height: h, depth: 1),
                to: dstTex,
                destinationSlice: 0,
                destinationLevel: 0,
                destinationOrigin: MTLOrigin(x: 0, y: 0, z: 0)
            )
            blit.endEncoding()

            let pts = CMTime(value: Int64(CACurrentMediaTime() * 1_000_000), timescale: 1_000_000)
            cmd.addCompletedHandler { [weak self] _ in
                self?.sink?.consume(pixelBuffer: dst, presentationTime: pts)
            }
            cmd.commit()
        }
    }

#endif
