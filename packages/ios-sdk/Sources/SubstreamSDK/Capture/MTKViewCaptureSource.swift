// MTKViewCaptureSource.swift
// Captures an `MTKView`'s current drawable into a BGRA `CVPixelBuffer` via a
// Metal blit into an IOSurface-backed texture — zero CPU round-trip.

#if canImport(MetalKit)

    import CoreMedia
    import CoreVideo
    import Foundation
    import Metal
    import MetalKit

    final class MTKViewCaptureSource: NSObject, SubstreamImageSource {

        var targetFps: Int {
            didSet { pacer.targetFps = targetFps }
        }

        private weak var view: MTKView?
        private weak var sink: SubstreamImageSink?

        private let device: MTLDevice
        private let commandQueue: MTLCommandQueue
        private let pacer: DisplayLinkPacer
        private let pool: PixelBufferPool
        private var textureCache: CVMetalTextureCache?
        private let captureQueue = DispatchQueue(
            label: "substream.capture.mtkview",
            qos: .userInteractive
        )

        init(view: MTKView, targetFps: Int) {
            self.view = view
            self.targetFps = targetFps
            self.pacer = DisplayLinkPacer(targetFps: targetFps)

            let mtlDevice = view.device ?? MTLCreateSystemDefaultDevice()
            guard let mtlDevice, let queue = mtlDevice.makeCommandQueue() else {
                fatalError("SubstreamSDK: no Metal device available")
            }
            self.device = mtlDevice
            self.commandQueue = queue

            let size = view.drawableSize
            self.pool = PixelBufferPool(
                width: Int(size.width > 0 ? size.width : 1280),
                height: Int(size.height > 0 ? size.height : 720)
            )
            super.init()

            var cache: CVMetalTextureCache?
            CVMetalTextureCacheCreate(
                kCFAllocatorDefault, nil, mtlDevice, nil, &cache
            )
            self.textureCache = cache
        }

        func attach(sink: SubstreamImageSink) {
            self.sink = sink
        }

        func start() throws {
            guard view != nil else {
                throw SubstreamError.captureUnavailable("MTKView was deallocated")
            }
            pacer.start { [weak self] in
                self?.capture()
            }
        }

        func stop() {
            pacer.stop()
        }

        // MARK: - Frame capture

        /// Called every display tick. Blits the current drawable's texture into
        /// a pool-allocated BGRA pixel buffer and pushes it to the sink.
        private func capture() {
            guard let view = view, let drawable = view.currentDrawable else { return }

            let texture = drawable.texture
            let w = texture.width
            let h = texture.height
            pool.resize(width: w, height: h)

            guard
                let dstBuffer = pool.dequeue(),
                let textureCache = textureCache
            else { return }

            var metalTextureRef: CVMetalTexture?
            let status = CVMetalTextureCacheCreateTextureFromImage(
                kCFAllocatorDefault,
                textureCache,
                dstBuffer,
                nil,
                .bgra8Unorm,
                w,
                h,
                0,
                &metalTextureRef
            )
            guard status == kCVReturnSuccess, let mtlRef = metalTextureRef,
                let dstTexture = CVMetalTextureGetTexture(mtlRef)
            else { return }

            guard let commandBuffer = commandQueue.makeCommandBuffer(),
                let blit = commandBuffer.makeBlitCommandEncoder()
            else { return }

            blit.copy(
                from: texture,
                sourceSlice: 0,
                sourceLevel: 0,
                sourceOrigin: MTLOrigin(x: 0, y: 0, z: 0),
                sourceSize: MTLSize(width: w, height: h, depth: 1),
                to: dstTexture,
                destinationSlice: 0,
                destinationLevel: 0,
                destinationOrigin: MTLOrigin(x: 0, y: 0, z: 0)
            )
            blit.endEncoding()

            let pts = CMTime(value: Int64(CACurrentMediaTime() * 1_000_000), timescale: 1_000_000)
            commandBuffer.addCompletedHandler { [weak self] _ in
                guard let self else { return }
                self.captureQueue.async {
                    self.sink?.consume(pixelBuffer: dstBuffer, presentationTime: pts)
                }
            }
            commandBuffer.commit()
        }
    }

#endif
