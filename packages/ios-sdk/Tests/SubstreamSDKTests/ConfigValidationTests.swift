import XCTest

@testable import SubstreamSDK

#if canImport(UIKit)

    final class ConfigValidationTests: XCTestCase {

        private func baseConfig(
            authToken: String = "tok",
            streamerId: String = "p1",
            fps: Int = 30,
            bitrate: Int = 2500
        ) -> SubstreamConfig {
            SubstreamConfig(
                backendUrl: URL(string: "https://example.com")!,
                authToken: authToken,
                streamerId: streamerId,
                capture: .replayKit,
                fps: fps,
                videoBitrateKbps: bitrate
            )
        }

        func testRejectsEmptyAuthToken() {
            do {
                try baseConfig(authToken: "").validate()
                XCTFail("expected throw")
            } catch let SubstreamError.invalidConfig(msg) {
                XCTAssertTrue(msg.contains("authToken"))
            } catch { XCTFail("unexpected: \(error)") }
        }

        func testRejectsEmptyStreamerId() {
            do {
                try baseConfig(streamerId: "").validate()
                XCTFail("expected throw")
            } catch let SubstreamError.invalidConfig(msg) {
                XCTAssertTrue(msg.contains("streamerId"))
            } catch { XCTFail("unexpected: \(error)") }
        }

        func testRejectsOutOfRangeFps() {
            do { try baseConfig(fps: 0).validate(); XCTFail() } catch {}
            do { try baseConfig(fps: 120).validate(); XCTFail() } catch {}
        }

        func testRejectsOutOfRangeBitrate() {
            do { try baseConfig(bitrate: 100).validate(); XCTFail() } catch {}
            do { try baseConfig(bitrate: 50_000).validate(); XCTFail() } catch {}
        }

        func testAcceptsSaneDefaults() throws {
            try baseConfig().validate()
        }
    }

#endif
