// ErrorBox.swift
// Tiny thread-safe container used to move an `Error` across a concurrency
// boundary (typically out of a `@Sendable` escaping closure back into the
// surrounding synchronous scope).
//
// Required because Swift 6 strict concurrency disallows a bare `var error:
// Error?` being captured mutably inside a `@Sendable` closure.

import Foundation

final class ErrorBox: @unchecked Sendable {
    private let lock = NSLock()
    private var _value: Error?

    var value: Error? {
        lock.lock()
        defer { lock.unlock() }
        return _value
    }

    func set(_ error: Error?) {
        lock.lock()
        defer { lock.unlock() }
        _value = error
    }
}
