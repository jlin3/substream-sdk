import XCTest

@testable import SubstreamSDK

/// Smoke test to ensure the module is reachable.
/// Real tests live alongside each subsystem (PublishAPITests, ReconnectorTests, …).
final class PlaceholderTests: XCTestCase {
    func testSDKVersionIsNonEmpty() {
        XCTAssertFalse(Substream.sdkVersion.isEmpty)
    }
}
