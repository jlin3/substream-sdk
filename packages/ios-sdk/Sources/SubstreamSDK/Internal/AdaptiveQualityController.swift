// AdaptiveQualityController.swift
// Responds to `ProcessInfo.thermalState` and low-power-mode by adjusting
// fps + target bitrate. Keeps the stream alive under thermal pressure
// rather than letting iOS throttle frames arbitrarily.
//
// Policy (hot > warm > cool):
//   .critical     →  540p @ 20 fps @ 800 kbps
//   .serious      →  720p @ 24 fps @ 1500 kbps
//   .fair / .nominal → config defaults
//
// When `isLowPowerModeEnabled`, we also clamp to the .serious tier.

import Foundation

/// Latest target values computed by the controller.
struct AdaptiveTarget: Equatable, Sendable {
    var fps: Int
    var bitrateKbps: Int
    var reason: String
}

final class AdaptiveQualityController {
    let baseFps: Int
    let baseBitrateKbps: Int
    private(set) var current: AdaptiveTarget

    init(baseFps: Int, baseBitrateKbps: Int) {
        self.baseFps = baseFps
        self.baseBitrateKbps = baseBitrateKbps
        self.current = AdaptiveTarget(
            fps: baseFps,
            bitrateKbps: baseBitrateKbps,
            reason: "nominal"
        )
    }

    /// Re-evaluate. Returns `true` if the target changed.
    @discardableResult
    func tick() -> Bool {
        let thermal = ProcessInfo.processInfo.thermalState
        let lowPower: Bool = {
            #if os(iOS) || os(tvOS) || os(watchOS)
                return ProcessInfo.processInfo.isLowPowerModeEnabled
            #else
                return false
            #endif
        }()
        let effective = lowPower ? max(thermal.rawValue, ProcessInfo.ThermalState.serious.rawValue) : thermal.rawValue

        let next: AdaptiveTarget
        switch effective {
        case ProcessInfo.ThermalState.critical.rawValue:
            next = .init(fps: 20, bitrateKbps: 800, reason: "thermal.critical")
        case ProcessInfo.ThermalState.serious.rawValue:
            next = .init(fps: 24, bitrateKbps: 1500, reason: lowPower ? "lowPowerMode" : "thermal.serious")
        default:
            next = .init(fps: baseFps, bitrateKbps: baseBitrateKbps, reason: "nominal")
        }
        let changed = next != current
        current = next
        return changed
    }
}
