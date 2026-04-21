// SubstreamBroadcastConfig.swift
// Cross-process config hand-off between the host app and a Broadcast
// Upload Extension.
//
// The host app calls `.save(...)` before presenting the
// `RPSystemBroadcastPickerView`. The extension calls `.load(...)` in
// `broadcastStarted(withSetupInfo:)`.
//
// We persist to the shared App Group's UserDefaults. The auth token lives
// here too, so it must be a short-lived token in production (rotate via
// your auth backend).

import Foundation

/// Config payload for a Broadcast Upload Extension.
public struct SubstreamBroadcastConfig: Codable, Sendable {
    public let backendUrl: URL
    public let authToken: String
    public let streamerId: String
    public let orgId: String?
    public let streamerName: String?
    public let title: String?

    public init(
        backendUrl: URL,
        authToken: String,
        streamerId: String,
        orgId: String? = nil,
        streamerName: String? = nil,
        title: String? = nil
    ) {
        self.backendUrl = backendUrl
        self.authToken = authToken
        self.streamerId = streamerId
        self.orgId = orgId
        self.streamerName = streamerName
        self.title = title
    }

    // MARK: Storage

    private static let key = "dev.substream.broadcast.config"

    /// Call from the host app before starting the broadcast picker.
    public static func save(_ config: SubstreamBroadcastConfig, appGroup: String) throws {
        guard let defaults = UserDefaults(suiteName: appGroup) else {
            throw SubstreamError.invalidConfig("App Group '\(appGroup)' is not reachable")
        }
        let data = try JSONEncoder().encode(config)
        defaults.set(data, forKey: key)
    }

    /// Call from inside the Broadcast Upload Extension.
    public static func load(appGroup: String) -> SubstreamBroadcastConfig? {
        guard let defaults = UserDefaults(suiteName: appGroup),
            let data = defaults.data(forKey: key)
        else { return nil }
        return try? JSONDecoder().decode(SubstreamBroadcastConfig.self, from: data)
    }

    /// Clear stored config. Call after the broadcast ends.
    public static func clear(appGroup: String) {
        UserDefaults(suiteName: appGroup)?.removeObject(forKey: key)
    }
}
