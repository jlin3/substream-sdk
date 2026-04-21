import CoreVideo
import XCTest

@testable import SubstreamSDK

final class PixelBufferPoolTests: XCTestCase {

    func testDequeueReturnsBufferOfRequestedSize() {
        let pool = PixelBufferPool(width: 640, height: 360)
        guard let buf = pool.dequeue() else {
            XCTFail("dequeue failed")
            return
        }
        XCTAssertEqual(CVPixelBufferGetWidth(buf), 640)
        XCTAssertEqual(CVPixelBufferGetHeight(buf), 360)
        XCTAssertEqual(CVPixelBufferGetPixelFormatType(buf), kCVPixelFormatType_32BGRA)
    }

    func testResizeChangesOutputSize() {
        let pool = PixelBufferPool(width: 320, height: 240)
        pool.resize(width: 1920, height: 1080)
        guard let buf = pool.dequeue() else {
            XCTFail("dequeue failed")
            return
        }
        XCTAssertEqual(CVPixelBufferGetWidth(buf), 1920)
        XCTAssertEqual(CVPixelBufferGetHeight(buf), 1080)
    }

    func testBuffersAreMetalCompatible() {
        let pool = PixelBufferPool(width: 128, height: 128)
        let buf = pool.dequeue()
        XCTAssertNotNil(buf)
        // IOSurface backing is required for Metal texture caches.
        XCTAssertNotNil(CVPixelBufferGetIOSurface(buf!))
    }
}
