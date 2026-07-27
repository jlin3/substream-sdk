import CoreMedia
import CoreVideo
import XCTest

@testable import SubstreamSDK

final class AnnotationTapConfigTests: XCTestCase {

    func testClampsValuesIntoSupportedRange() {
        let url = URL(string: "wss://example.com/frames")!
        let tooHigh = AnnotationTapConfig(
            framesUrl: url,
            framesPerSecond: 60,
            maxDimension: 4096,
            jpegQuality: 2.0,
            maxQueuedFrames: 5000
        )
        XCTAssertEqual(tooHigh.framesPerSecond, 4.0)
        XCTAssertEqual(tooHigh.maxDimension, 1280)
        XCTAssertEqual(tooHigh.jpegQuality, 0.9)
        XCTAssertEqual(tooHigh.maxQueuedFrames, 30)

        let tooLow = AnnotationTapConfig(
            framesUrl: url,
            framesPerSecond: 0,
            maxDimension: 1,
            jpegQuality: 0,
            maxQueuedFrames: 0
        )
        XCTAssertEqual(tooLow.framesPerSecond, 0.2)
        XCTAssertEqual(tooLow.maxDimension, 160)
        XCTAssertEqual(tooLow.jpegQuality, 0.1)
        XCTAssertEqual(tooLow.maxQueuedFrames, 1)
    }

    func testBroadcastConfigDecodesWithoutAnnotationKey() throws {
        // A host app built against an older SDK stores no `annotation` key. That
        // payload has to keep decoding, or an SDK upgrade silently breaks
        // broadcasts that were working.
        let json = """
            {
              "backendUrl": "https://api.example.com",
              "authToken": "t",
              "streamerId": "s1"
            }
            """
        let config = try JSONDecoder().decode(
            SubstreamBroadcastConfig.self, from: Data(json.utf8)
        )
        XCTAssertNil(config.annotation)
        XCTAssertEqual(config.streamerId, "s1")
    }

    func testBroadcastConfigRoundTripsAnnotation() throws {
        let original = SubstreamBroadcastConfig(
            backendUrl: URL(string: "https://api.example.com")!,
            authToken: "t",
            streamerId: "s1",
            annotation: AnnotationTapConfig(
                framesUrl: URL(string: "wss://annotate.example.com/frames")!,
                framesPerSecond: 2.0
            )
        )
        let data = try JSONEncoder().encode(original)
        let decoded = try JSONDecoder().decode(SubstreamBroadcastConfig.self, from: data)
        XCTAssertEqual(decoded.annotation?.framesPerSecond, 2.0)
        XCTAssertEqual(
            decoded.annotation?.framesUrl.absoluteString,
            "wss://annotate.example.com/frames"
        )
    }
}

#if canImport(UIKit)

    final class AnnotationTapTests: XCTestCase {

        private func makeConfig(
            fps: Double = 1.0, maxDimension: Int = 480, queue: Int = 4
        ) -> AnnotationTapConfig {
            AnnotationTapConfig(
                // Reserved TEST-NET-1 address: unroutable, so a send can never
                // reach a real host even if the test environment has network.
                framesUrl: URL(string: "ws://192.0.2.1:9/frames")!,
                framesPerSecond: fps,
                maxDimension: maxDimension,
                maxQueuedFrames: queue
            )
        }

        private func makePixelBuffer(width: Int, height: Int) -> CVPixelBuffer {
            var pb: CVPixelBuffer?
            let attrs: [CFString: Any] = [
                kCVPixelBufferIOSurfacePropertiesKey: [:] as CFDictionary
            ]
            CVPixelBufferCreate(
                kCFAllocatorDefault, width, height, kCVPixelFormatType_32BGRA,
                attrs as CFDictionary, &pb
            )
            let buffer = pb!
            // Fill with non-uniform content so the JPEG cannot degenerate to a
            // handful of bytes and mask an encoder problem.
            CVPixelBufferLockBaseAddress(buffer, [])
            if let base = CVPixelBufferGetBaseAddress(buffer) {
                let bytesPerRow = CVPixelBufferGetBytesPerRow(buffer)
                let ptr = base.assumingMemoryBound(to: UInt8.self)
                for y in 0..<height {
                    for x in 0..<bytesPerRow {
                        ptr[y * bytesPerRow + x] = UInt8((x * 7 + y * 13) % 256)
                    }
                }
            }
            CVPixelBufferUnlockBaseAddress(buffer, [])
            return buffer
        }

        // MARK: - Encoding

        func testEncodeDownscalesToMaxDimension() throws {
            let buffer = makePixelBuffer(width: 1280, height: 720)
            let data = try XCTUnwrap(
                AnnotationTap.encodeJPEG(pixelBuffer: buffer, maxDimension: 480, quality: 0.5)
            )
            let image = try XCTUnwrap(UIImage(data: data))
            XCTAssertEqual(Int(image.size.width), 480)
            // 720 * (480/1280) = 270, aspect ratio preserved.
            XCTAssertEqual(Int(image.size.height), 270)
        }

        func testEncodeDoesNotUpscaleSmallFrames() throws {
            let buffer = makePixelBuffer(width: 320, height: 180)
            let data = try XCTUnwrap(
                AnnotationTap.encodeJPEG(pixelBuffer: buffer, maxDimension: 480, quality: 0.5)
            )
            let image = try XCTUnwrap(UIImage(data: data))
            XCTAssertEqual(Int(image.size.width), 320)
            XCTAssertEqual(Int(image.size.height), 180)
        }

        func testEncodedFrameIsSmallEnoughForSustainedStreaming() throws {
            let buffer = makePixelBuffer(width: 1280, height: 720)
            let data = try XCTUnwrap(
                AnnotationTap.encodeJPEG(pixelBuffer: buffer, maxDimension: 480, quality: 0.5)
            )
            // At 1fps a frame this size is well under 1 Mbps of tap overhead,
            // which is the constraint that keeps the tap invisible to the
            // broadcast's upload budget.
            XCTAssertLessThan(data.count, 120_000)
            XCTAssertGreaterThan(data.count, 500)
        }

        // MARK: - Sampling

        func testConsumeIgnoresFramesBeforeStart() {
            let tap = AnnotationTap(config: makeConfig())
            let buffer = makePixelBuffer(width: 320, height: 180)
            tap.consume(pixelBuffer: buffer, pts: CMTime(seconds: 0, preferredTimescale: 600))
            XCTAssertEqual(tap.currentStats.framesSampled, 0)
        }

        func testConsumeThrottlesToConfiguredFrameRate() {
            let tap = AnnotationTap(config: makeConfig(fps: 1.0, queue: 30))
            tap.start()
            defer { tap.stop() }

            let buffer = makePixelBuffer(width: 320, height: 180)
            // Three seconds of 30fps video. At 1fps the tap should take 3 or 4
            // frames (t=0 plus one per second boundary), never all 90.
            for i in 0..<90 {
                let pts = CMTime(value: CMTimeValue(i), timescale: 30)
                tap.consume(pixelBuffer: buffer, pts: pts)
            }

            let sampled = tap.currentStats.framesSampled
            XCTAssertGreaterThanOrEqual(sampled, 3)
            XCTAssertLessThanOrEqual(sampled, 4)
        }

        func testHigherFrameRateSamplesMoreFrames() {
            let slow = AnnotationTap(config: makeConfig(fps: 1.0, queue: 30))
            let fast = AnnotationTap(config: makeConfig(fps: 2.0, queue: 30))
            slow.start()
            fast.start()
            defer {
                slow.stop()
                fast.stop()
            }

            let buffer = makePixelBuffer(width: 320, height: 180)
            for i in 0..<120 {
                let pts = CMTime(value: CMTimeValue(i), timescale: 30)
                slow.consume(pixelBuffer: buffer, pts: pts)
                fast.consume(pixelBuffer: buffer, pts: pts)
            }

            XCTAssertGreaterThan(
                fast.currentStats.framesSampled, slow.currentStats.framesSampled
            )
        }

        func testQueueOverflowDropsFramesRatherThanGrowing() {
            // Queue of 1 against an unroutable host: the first frame occupies the
            // slot indefinitely, so every later frame must be dropped rather than
            // accumulating in memory. This is the property that keeps the
            // extension inside its 50 MB budget.
            let tap = AnnotationTap(config: makeConfig(fps: 4.0, queue: 1))
            tap.start()
            defer { tap.stop() }

            let buffer = makePixelBuffer(width: 320, height: 180)
            for i in 0..<40 {
                let pts = CMTime(value: CMTimeValue(i), timescale: 4)
                tap.consume(pixelBuffer: buffer, pts: pts)
            }

            let stats = tap.currentStats
            XCTAssertGreaterThan(stats.framesDroppedQueueFull, 0)
            XCTAssertLessThanOrEqual(stats.framesSampled, 2)
        }

        func testConsumeAfterStopIsIgnored() {
            let tap = AnnotationTap(config: makeConfig(queue: 30))
            tap.start()
            tap.stop()

            let buffer = makePixelBuffer(width: 320, height: 180)
            let before = tap.currentStats.framesSampled
            for i in 0..<30 {
                tap.consume(
                    pixelBuffer: buffer, pts: CMTime(value: CMTimeValue(i), timescale: 1)
                )
            }
            XCTAssertEqual(tap.currentStats.framesSampled, before)
        }

        func testNonMonotonicClockDoesNotStallSampling() {
            // A reset or rewound PTS previously made `elapsed` negative forever,
            // which would silently stop annotation for the rest of a broadcast.
            let tap = AnnotationTap(config: makeConfig(fps: 1.0, queue: 30))
            tap.start()
            defer { tap.stop() }

            let buffer = makePixelBuffer(width: 320, height: 180)
            tap.consume(pixelBuffer: buffer, pts: CMTime(seconds: 100, preferredTimescale: 600))
            let afterFirst = tap.currentStats.framesSampled

            tap.consume(pixelBuffer: buffer, pts: CMTime(seconds: 0, preferredTimescale: 600))
            XCTAssertGreaterThan(tap.currentStats.framesSampled, afterFirst)
        }

        func testStartIsIdempotentAndStopIsSafeWithoutStart() {
            let tap = AnnotationTap(config: makeConfig())
            tap.stop()  // must not crash before start
            tap.start()
            tap.start()  // second start must be a no-op
            tap.stop()
            tap.stop()  // second stop must be a no-op
            XCTAssertFalse(tap.currentStats.isConnected)
        }
    }

#endif
