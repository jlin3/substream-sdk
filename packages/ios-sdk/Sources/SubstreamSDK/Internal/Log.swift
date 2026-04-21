// Log.swift
// Lightweight structured logging with an os.Logger backend.

import Foundation
import os

/// Internal logger. Prefixed with `[Substream]` to match the web SDK's console output.
enum Log {
    static let subsystem = "dev.substream.sdk"

    static let general = Logger(subsystem: subsystem, category: "general")
    static let network = Logger(subsystem: subsystem, category: "network")
    static let capture = Logger(subsystem: subsystem, category: "capture")
    static let ivs = Logger(subsystem: subsystem, category: "ivs")

    static func info(_ message: @autoclosure @escaping () -> String, category: Logger = general) {
        category.info("\(message(), privacy: .public)")
    }

    static func warn(_ message: @autoclosure @escaping () -> String, category: Logger = general) {
        category.warning("\(message(), privacy: .public)")
    }

    static func error(_ message: @autoclosure @escaping () -> String, category: Logger = general) {
        category.error("\(message(), privacy: .public)")
    }
}
