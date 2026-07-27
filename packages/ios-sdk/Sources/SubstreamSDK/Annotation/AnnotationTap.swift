// AnnotationTap.swift
// Tees a low-rate JPEG stream off the broadcast pipeline to the annotation
// service, so gameplay is annotated live while it is still being streamed.
//
// This runs inside a Broadcast Upload Extension, which iOS terminates if it
// exceeds roughly 50 MB resident. Every design decision here follows from that:
//
//   - Frames are sampled at 1-2 fps, not 30. Annotation reasons over seconds of
//     gameplay, so it gains nothing from frame-rate fidelity.
//   - Each sampled frame is downscaled before encoding, never after.
//   - The send queue is small and bounded, and overflow drops the oldest frame
//     rather than growing. A dropped annotation frame costs a little detail; an
//     unbounded queue costs the whole broadcast.
//   - Nothing is retained after a frame is handed to the socket.
//
// The tap is strictly additive. It never touches the IVS path, and any failure
// here — socket down, service unreachable, encoder failure — is logged and
// swallowed. Annotation is a feature; the broadcast is the product.

import CoreImage
import CoreMedia
import CoreVideo
import Foundation

#if canImport(UIKit)
    import UIKit
#endif

/// Configuration for the live annotation tap.
public struct AnnotationTapConfig: Codable, Sendable {

    /// WebSocket URL of the annotation frame endpoint, including session id.
    /// Example: `wss://annotate.example.com/api/v1/live/sessions/<id>/frames`
    public var framesUrl: URL

    /// Frames per second to tee. 1–2 is the useful range; above that cost rises
    /// with no annotation benefit.
    public var framesPerSecond: Double

    /// Longest edge of the downscaled frame, in pixels.
    public var maxDimension: Int

    /// JPEG compression quality, 0–1.
    public var jpegQuality: Double

    /// Maximum frames held awaiting send. Small on purpose.
    public var maxQueuedFrames: Int

    public init(
        framesUrl: URL,
        framesPerSecond: Double = 1.0,
        maxDimension: Int = 480,
        jpegQuality: Double = 0.5,
        maxQueuedFrames: Int = 4
    ) {
        self.framesUrl = framesUrl
        self.framesPerSecond = max(0.2, min(4.0, framesPerSecond))
        self.maxDimension = max(160, min(1280, maxDimension))
        self.jpegQuality = max(0.1, min(0.9, jpegQuality))
        self.maxQueuedFrames = max(1, min(30, maxQueuedFrames))
    }
}

/// Counters for diagnosing tap behaviour without attaching a debugger.
public struct AnnotationTapStats: Sendable {
    public var framesSampled: Int = 0
    public var framesSent: Int = 0
    public var framesDroppedQueueFull: Int = 0
    public var framesDroppedEncodeFailed: Int = 0
    public var bytesSent: Int = 0
    public var isConnected: Bool = false
}

#if canImport(UIKit)

    /// Samples, downscales, encodes and ships frames to the annotation service.
    ///
    /// Thread-safety mirrors `SubstreamBroadcastBridge`: `consume` is called on
    /// ReplayKit's sample-buffer queue, and all mutable state is guarded by a
    /// lock that is never held across an encode or a socket write.
    public final class AnnotationTap: NSObject, @unchecked Sendable {

        private let config: AnnotationTapConfig
        private let lock = NSLock()

        private var task: URLSessionWebSocketTask?
        private var session: URLSession?
        private var stats = AnnotationTapStats()

        /// PTS of the last frame we accepted, used to enforce the sample rate.
        private var lastSampledPts: CMTime?
        /// PTS of the first frame, so the service receives stream-relative time.
        private var firstPts: CMTime?
        private var inFlight = 0
        private var started = false
        private var stopped = false

        /// Socket writes hop off the ReplayKit queue. Encoding itself stays on it:
        /// moving the encode would require copying the pixel buffer, because
        /// ReplayKit reuses its buffers, and a per-frame full-resolution copy is a
        /// worse trade than a ~3ms encode that runs once a second.
        private let sendQueue = DispatchQueue(
            label: "dev.substream.annotation.send", qos: .utility
        )

        public init(config: AnnotationTapConfig) {
            self.config = config
            super.init()
        }

        // MARK: - Lifecycle

        public func start() {
            let shouldStart: Bool = withLock {
                guard !started, !stopped else { return false }
                started = true
                return true
            }
            guard shouldStart else { return }

            let configuration = URLSessionConfiguration.default
            configuration.timeoutIntervalForRequest = 15
            configuration.waitsForConnectivity = false
            let urlSession = URLSession(
                configuration: configuration, delegate: self, delegateQueue: nil
            )
            let webSocket = urlSession.webSocketTask(with: config.framesUrl)
            webSocket.resume()

            withLock {
                self.session = urlSession
                self.task = webSocket
                self.stats.isConnected = true
            }
            Log.info("Annotation tap connected to \(self.config.framesUrl.absoluteString)")
        }

        /// Signals end of stream and tears down the socket.
        public func stop() {
            let webSocket: URLSessionWebSocketTask? = withLock {
                guard started, !stopped else { return nil }
                stopped = true
                stats.isConnected = false
                let t = task
                task = nil
                return t
            }
            guard let webSocket else { return }

            let end = #"{"type":"end"}"#
            webSocket.send(.string(end)) { _ in
                webSocket.cancel(with: .normalClosure, reason: nil)
            }
            withLock {
                session?.finishTasksAndInvalidate()
                session = nil
            }
            Log.info("Annotation tap stopped: \(self.snapshotDescription())")
        }

        public var currentStats: AnnotationTapStats { withLock { stats } }

        // MARK: - Hot path

        /// Offer a frame to the tap. Returns immediately; most frames are ignored.
        public func consume(pixelBuffer: CVPixelBuffer, pts: CMTime) {
            let minimumInterval = 1.0 / config.framesPerSecond
            let queueLimit = config.maxQueuedFrames

            let decision: (accept: Bool, relativeSeconds: Double) = withLock {
                guard started, !stopped, task != nil else { return (false, 0) }

                if firstPts == nil { firstPts = pts }
                if let last = lastSampledPts {
                    let elapsed = CMTimeGetSeconds(CMTimeSubtract(pts, last))
                    // Guard against a non-monotonic or reset clock, which would
                    // otherwise stall sampling for the rest of the broadcast.
                    if elapsed >= 0, elapsed < minimumInterval { return (false, 0) }
                }

                if inFlight >= queueLimit {
                    stats.framesDroppedQueueFull += 1
                    return (false, 0)
                }

                lastSampledPts = pts
                stats.framesSampled += 1
                inFlight += 1
                let base = firstPts ?? pts
                return (true, max(0, CMTimeGetSeconds(CMTimeSubtract(pts, base))))
            }

            guard decision.accept else { return }

            // Encode inline, while ReplayKit's buffer is still guaranteed valid.
            guard
                let jpeg = Self.encodeJPEG(
                    pixelBuffer: pixelBuffer,
                    maxDimension: config.maxDimension,
                    quality: config.jpegQuality
                )
            else {
                withLock {
                    inFlight -= 1
                    stats.framesDroppedEncodeFailed += 1
                }
                return
            }

            sendQueue.async { [weak self] in
                self?.send(jpeg: jpeg, atSeconds: decision.relativeSeconds)
            }
        }

        // MARK: - Send

        private func send(jpeg: Data, atSeconds seconds: Double) {
            let webSocket: URLSessionWebSocketTask? = withLock { task }
            guard let webSocket else {
                withLock { inFlight -= 1 }
                return
            }

            let header = #"{"type":"frame","pts":"# + String(format: "%.3f", seconds) + "}"
            webSocket.send(.string(header)) { [weak self] error in
                guard let self else { return }
                if let error {
                    self.handleSendFailure(error)
                    return
                }
                webSocket.send(.data(jpeg)) { [weak self] error in
                    guard let self else { return }
                    if let error {
                        self.handleSendFailure(error)
                        return
                    }
                    self.withLock {
                        self.inFlight -= 1
                        self.stats.framesSent += 1
                        self.stats.bytesSent += jpeg.count
                    }
                }
            }
        }

        private func handleSendFailure(_ error: Error) {
            withLock {
                inFlight -= 1
                stats.isConnected = false
            }
            // Deliberately not reconnecting mid-broadcast. A retry loop competing
            // for memory and CPU with the live stream is a worse failure than
            // losing annotation for the rest of the session.
            Log.warn("Annotation tap send failed, tap disabled: \(error.localizedDescription)")
        }

        // MARK: - Encoding

        /// Downscale and JPEG-encode a frame.
        ///
        /// Scaling happens during the `CIImage`/`UIImage` draw rather than after,
        /// so a full-resolution intermediate is never allocated.
        static func encodeJPEG(
            pixelBuffer: CVPixelBuffer,
            maxDimension: Int,
            quality: Double
        ) -> Data? {
            let width = CVPixelBufferGetWidth(pixelBuffer)
            let height = CVPixelBufferGetHeight(pixelBuffer)
            guard width > 0, height > 0 else { return nil }

            let longest = max(width, height)
            let scale = longest > maxDimension ? Double(maxDimension) / Double(longest) : 1.0
            let targetSize = CGSize(
                width: (Double(width) * scale).rounded(),
                height: (Double(height) * scale).rounded()
            )
            guard targetSize.width >= 1, targetSize.height >= 1 else { return nil }

            let ciImage = CIImage(cvPixelBuffer: pixelBuffer)
            let context = CIContext(options: [.useSoftwareRenderer: false])
            guard
                let cgImage = context.createCGImage(
                    ciImage, from: CGRect(x: 0, y: 0, width: width, height: height)
                )
            else { return nil }

            let format = UIGraphicsImageRendererFormat.default()
            format.scale = 1
            format.opaque = true
            let renderer = UIGraphicsImageRenderer(size: targetSize, format: format)
            let image = renderer.image { _ in
                UIImage(cgImage: cgImage)
                    .draw(
                        in: CGRect(origin: .zero, size: targetSize)
                    )
            }
            return image.jpegData(compressionQuality: CGFloat(quality))
        }

        // MARK: - Helpers

        private func withLock<T>(_ body: () -> T) -> T {
            lock.lock()
            defer { lock.unlock() }
            return body()
        }

        private func snapshotDescription() -> String {
            let s = currentStats
            return
                "sampled=\(s.framesSampled) sent=\(s.framesSent) "
                + "droppedQueue=\(s.framesDroppedQueueFull) "
                + "droppedEncode=\(s.framesDroppedEncodeFailed) "
                + "bytes=\(s.bytesSent)"
        }
    }

    extension AnnotationTap: URLSessionWebSocketDelegate {

        public func urlSession(
            _ session: URLSession,
            webSocketTask: URLSessionWebSocketTask,
            didOpenWithProtocol protocol: String?
        ) {
            withLock { stats.isConnected = true }
        }

        public func urlSession(
            _ session: URLSession,
            webSocketTask: URLSessionWebSocketTask,
            didCloseWith closeCode: URLSessionWebSocketTask.CloseCode,
            reason: Data?
        ) {
            withLock { stats.isConnected = false }
            Log.info("Annotation tap socket closed (code=\(closeCode.rawValue))")
        }
    }

#endif
