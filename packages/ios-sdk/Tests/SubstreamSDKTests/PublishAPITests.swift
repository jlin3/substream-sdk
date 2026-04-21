import XCTest

@testable import SubstreamSDK

/// Exercises `PublishAPI` against a fake `URLProtocol` so we never hit the network.
final class PublishAPITests: XCTestCase {

    override func setUp() {
        super.setUp()
        URLProtocol.registerClass(FakeURLProtocol.self)
        FakeURLProtocol.reset()
    }

    override func tearDown() {
        URLProtocol.unregisterClass(FakeURLProtocol.self)
        super.tearDown()
    }

    private func makeAPI() -> PublishAPI {
        let config = URLSessionConfiguration.ephemeral
        config.protocolClasses = [FakeURLProtocol.self] + (config.protocolClasses ?? [])
        let session = URLSession(configuration: config)
        return PublishAPI(
            backendUrl: URL(string: "https://api.example.com")!,
            authToken: "test-token",
            urlSession: session
        )
    }

    func testRequestPublishTokenDecodes() async throws {
        FakeURLProtocol.nextResponse = (
            status: 201,
            body: #"""
                {
                  "streamId": "abc-123",
                  "stageArn": "arn:aws:ivs:us-east-1:1:stage/xxx",
                  "publishToken": "tok-xyz",
                  "viewerUrl": "https://api.example.com/viewer/abc-123"
                }
                """#.data(using: .utf8)!
        )

        let api = makeAPI()
        let response = try await api.requestPublishToken(
            PublishRequest(
                streamerId: "p1",
                orgId: nil,
                streamerName: nil,
                title: nil,
                platform: "ios",
                sdkVersion: "1.0.0"
            )
        )
        XCTAssertEqual(response.streamId, "abc-123")
        XCTAssertEqual(response.publishToken, "tok-xyz")
        XCTAssertEqual(response.viewerUrl, "https://api.example.com/viewer/abc-123")
    }

    func testAuthErrorMapsToAuthCase() async {
        FakeURLProtocol.nextResponse = (
            status: 401,
            body: #"{"error":"bad token"}"#.data(using: .utf8)!
        )

        let api = makeAPI()
        do {
            _ = try await api.requestPublishToken(
                PublishRequest(
                    streamerId: "p1",
                    orgId: nil,
                    streamerName: nil,
                    title: nil,
                    platform: "ios",
                    sdkVersion: "1.0.0"
                )
            )
            XCTFail("expected throw")
        } catch let SubstreamError.auth(msg) {
            XCTAssertTrue(msg.contains("bad token"), "msg=\(msg)")
        } catch {
            XCTFail("unexpected error: \(error)")
        }
    }

    func testNetworkErrorMaps() async {
        FakeURLProtocol.nextResponse = (
            status: 500,
            body: #"{"error":"boom"}"#.data(using: .utf8)!
        )

        let api = makeAPI()
        do {
            _ = try await api.requestPublishToken(
                PublishRequest(
                    streamerId: "p1",
                    orgId: nil,
                    streamerName: nil,
                    title: nil,
                    platform: "ios",
                    sdkVersion: "1.0.0"
                )
            )
            XCTFail("expected throw")
        } catch let SubstreamError.network(status, msg) {
            XCTAssertEqual(status, 500)
            XCTAssertTrue(msg.contains("boom"))
        } catch {
            XCTFail("unexpected error: \(error)")
        }
    }
}

// MARK: - Fake URLProtocol

final class FakeURLProtocol: URLProtocol {
    nonisolated(unsafe) static var nextResponse: (status: Int, body: Data) = (200, Data())

    static func reset() { nextResponse = (200, Data()) }

    override class func canInit(with request: URLRequest) -> Bool { true }
    override class func canonicalRequest(for request: URLRequest) -> URLRequest { request }

    override func startLoading() {
        let (status, body) = Self.nextResponse
        let response = HTTPURLResponse(
            url: request.url!,
            statusCode: status,
            httpVersion: "HTTP/1.1",
            headerFields: ["Content-Type": "application/json"]
        )!
        client?.urlProtocol(self, didReceive: response, cacheStoragePolicy: .notAllowed)
        client?.urlProtocol(self, didLoad: body)
        client?.urlProtocolDidFinishLoading(self)
    }

    override func stopLoading() {}
}
