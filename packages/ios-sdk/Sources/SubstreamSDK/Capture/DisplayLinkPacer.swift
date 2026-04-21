// DisplayLinkPacer.swift
// CADisplayLink-driven frame pacer used by the view-based capture sources.
// Coalesces display updates to the target fps so we don't over-capture.
//
// iOS-only: CADisplayLink's preferred-fps APIs are unavailable on macOS.
// Non-iOS builds fall back to a no-op pacer so the rest of the SDK compiles
// for unit tests on macOS.

import Foundation

#if canImport(UIKit)

    import QuartzCore
    import UIKit

    final class DisplayLinkPacer {

        var targetFps: Int {
            didSet { applyFps() }
        }

        private var link: CADisplayLink?
        private var handler: (() -> Void)?

        init(targetFps: Int) {
            self.targetFps = targetFps
        }

        func start(_ handler: @escaping () -> Void) {
            self.handler = handler
            let link = CADisplayLink(target: self, selector: #selector(tick))
            applyFps(on: link)
            link.add(to: .main, forMode: .common)
            self.link = link
        }

        func stop() {
            link?.invalidate()
            link = nil
            handler = nil
        }

        @objc private func tick() {
            handler?()
        }

        private func applyFps(on link: CADisplayLink? = nil) {
            let target = link ?? self.link
            guard let target else { return }
            if #available(iOS 15.0, *) {
                target.preferredFrameRateRange = CAFrameRateRange(
                    minimum: Float(max(1, targetFps - 5)),
                    maximum: Float(targetFps),
                    preferred: Float(targetFps)
                )
            } else {
                target.preferredFramesPerSecond = targetFps
            }
        }
    }

#else

    /// macOS / non-UIKit stub. Never instantiated on device; exists so the rest
    /// of the SDK compiles for unit tests.
    final class DisplayLinkPacer {
        var targetFps: Int
        init(targetFps: Int) { self.targetFps = targetFps }
        func start(_ handler: @escaping () -> Void) {}
        func stop() {}
    }

#endif
