import XCTest

@testable import SubstreamSDK

final class ReconnectorTests: XCTestCase {

    func testDelayGrowsExponentiallyAndCaps() {
        let r = Reconnector(
            maxAttempts: 10,
            baseDelay: 1.0,
            maxDelay: 10.0,
            multiplier: 2.0,
            jitter: 0.0
        )
        XCTAssertEqual(r.delay(forAttempt: 1), 1.0, accuracy: 0.01)
        XCTAssertEqual(r.delay(forAttempt: 2), 2.0, accuracy: 0.01)
        XCTAssertEqual(r.delay(forAttempt: 3), 4.0, accuracy: 0.01)
        XCTAssertEqual(r.delay(forAttempt: 4), 8.0, accuracy: 0.01)
        XCTAssertEqual(r.delay(forAttempt: 5), 10.0, accuracy: 0.01) // capped
        XCTAssertEqual(r.delay(forAttempt: 20), 10.0, accuracy: 0.01) // capped
    }

    func testStopsAfterMaxAttempts() async {
        let r = Reconnector(maxAttempts: 3, baseDelay: 0.0, maxDelay: 0.0, multiplier: 1.0, jitter: 0.0)
        var attempts = 0
        do {
            try await r.run(
                onAttempt: { _ in attempts += 1 },
                operation: {
                    throw SubstreamError.internalError("nope")
                }
            )
            XCTFail("expected throw")
        } catch {
            XCTAssertEqual(attempts, 3)
        }
    }

    func testReturnsOnSuccess() async throws {
        let r = Reconnector(maxAttempts: 5, baseDelay: 0.0, maxDelay: 0.0, multiplier: 1.0, jitter: 0.0)
        var attempts = 0
        try await r.run(
            onAttempt: { _ in attempts += 1 },
            operation: {
                if attempts < 3 { throw SubstreamError.internalError("retry me") }
            }
        )
        XCTAssertEqual(attempts, 3)
    }
}
