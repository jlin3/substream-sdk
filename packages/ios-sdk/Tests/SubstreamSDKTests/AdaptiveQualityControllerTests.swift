import XCTest

@testable import SubstreamSDK

final class AdaptiveQualityControllerTests: XCTestCase {

    func testDefaultReturnsBaseTarget() {
        let c = AdaptiveQualityController(baseFps: 30, baseBitrateKbps: 2500)
        XCTAssertEqual(c.current.fps, 30)
        XCTAssertEqual(c.current.bitrateKbps, 2500)
    }

    func testFrameStatsMarksDelivered() {
        let s = FrameStats(window: 10)
        for _ in 0..<5 { s.markDelivered() }
        XCTAssertEqual(s.fps, 5)
    }

    func testFrameStatsCountsDrops() {
        let s = FrameStats()
        s.markDropped()
        s.markDropped()
        XCTAssertEqual(s.droppedFrames, 2)
        s.resetDroppedCounter()
        XCTAssertEqual(s.droppedFrames, 0)
    }
}
