// PublishAPI.swift
// Thin client for the Substream backend.
//
// Endpoints used:
//   POST   /api/streams/web-publish                  — allocate stage + publishToken
//   DELETE /api/streams/web-publish                  — release stage
//   POST   /api/streams/sessions/{sessionId}/heartbeat — optional health ping
//
// The backend treats iOS and web clients identically; we just add a `platform`
// field and `X-Substream-SDK` header so the dashboard can segment.

import Foundation

/// Request body sent to `POST /api/streams/web-publish`.
struct PublishRequest: Encodable {
    let streamerId: String
    let orgId: String?
    let streamerName: String?
    let title: String?
    let platform: String
    let sdkVersion: String
}

/// Response from `POST /api/streams/web-publish`.
struct PublishResponse: Decodable {
    let streamId: String
    let stageArn: String
    let publishToken: String
    let participantId: String?
    let expiresAt: String?
    let region: String?
    let viewerUrl: String
}

struct PublishAPIError: Decodable {
    let error: String?
    let code: String?
}

/// Thin HTTP client around the Substream backend.
///
/// Injectable via `urlSession` for tests (see `PublishAPITests`).
struct PublishAPI {
    let backendUrl: URL
    let authToken: String
    let urlSession: URLSession

    init(backendUrl: URL, authToken: String, urlSession: URLSession = .shared) {
        self.backendUrl = backendUrl
        self.authToken = authToken
        self.urlSession = urlSession
    }

    /// Request a publish token. Returns the decoded backend response.
    func requestPublishToken(_ body: PublishRequest) async throws -> PublishResponse {
        let url = backendUrl.appendingPathComponent("api/streams/web-publish")
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.setValue("Bearer \(authToken)", forHTTPHeaderField: "Authorization")
        request.setValue(
            "\(Substream.sdkPlatform)/\(Substream.sdkVersion)",
            forHTTPHeaderField: "X-Substream-SDK"
        )

        let encoder = JSONEncoder()
        encoder.keyEncodingStrategy = .useDefaultKeys
        request.httpBody = try encoder.encode(body)

        let (data, response) = try await performRequest(request)
        try Self.validate(response: response, data: data)

        do {
            return try JSONDecoder().decode(PublishResponse.self, from: data)
        } catch {
            throw SubstreamError.internalError(
                "Failed to decode PublishResponse: \(error.localizedDescription)"
            )
        }
    }

    /// Notify the backend that the stream has stopped. Best-effort; failures are logged but not thrown.
    func releaseStream(streamId: String) async {
        let url = backendUrl.appendingPathComponent("api/streams/web-publish")
        var request = URLRequest(url: url)
        request.httpMethod = "DELETE"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.setValue("Bearer \(authToken)", forHTTPHeaderField: "Authorization")
        request.httpBody = try? JSONSerialization.data(
            withJSONObject: ["streamId": streamId],
            options: []
        )

        do {
            let (data, response) = try await performRequest(request)
            try Self.validate(response: response, data: data)
        } catch {
            Log.warn("releaseStream failed: \(error)", category: Log.network)
        }
    }

    /// Send a heartbeat with current stats. Best-effort.
    func heartbeat(sessionId: String, bitrateKbps: Int, health: String) async {
        let url = backendUrl.appendingPathComponent("api/streams/sessions/\(sessionId)/heartbeat")
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.setValue("Bearer \(authToken)", forHTTPHeaderField: "Authorization")
        request.httpBody = try? JSONSerialization.data(
            withJSONObject: [
                "currentBitrateKbps": bitrateKbps,
                "streamHealth": health,
            ],
            options: []
        )

        _ = try? await performRequest(request)
    }

    // MARK: - Helpers

    private func performRequest(_ request: URLRequest) async throws -> (Data, URLResponse) {
        do {
            return try await urlSession.data(for: request)
        } catch {
            throw SubstreamError.transport(underlying: error)
        }
    }

    /// Translate HTTP status codes into `SubstreamError`.
    static func validate(response: URLResponse, data: Data) throws {
        guard let http = response as? HTTPURLResponse else {
            throw SubstreamError.internalError("Non-HTTP response")
        }
        if (200..<300).contains(http.statusCode) {
            return
        }

        let message: String
        if let parsed = try? JSONDecoder().decode(PublishAPIError.self, from: data),
            let err = parsed.error
        {
            message = err
        } else {
            message = String(data: data, encoding: .utf8) ?? "unknown"
        }

        switch http.statusCode {
        case 401, 403:
            throw SubstreamError.auth(message)
        default:
            throw SubstreamError.network(status: http.statusCode, message: message)
        }
    }
}
