// swift-tools-version: 5.9
// The swift-tools-version declares the minimum version of Swift required to build this package.
//
// SubstreamSDK for iOS — Native live-streaming SDK for iOS games.
//
// Adds live streaming to any iOS game with 5 lines of Swift. Wraps the
// Amazon IVS Broadcast SDK and the same backend contract the web SDK uses
// (`POST /api/streams/web-publish`), so a single backend serves web + iOS.
//
// Minimum targets:
//   - iOS 14.0 (MTKView / SpriteKit / SceneKit / UIView capture + in-app ReplayKit)
//   - iOS 14.0 Broadcast Upload Extensions (system-wide capture)
//
// Dependencies:
//   - AmazonIVSBroadcast (binary xcframework) — IVS Real-Time participant SDK
//
// AmazonIVSBroadcast is declared as a binary SwiftPM target against the
// AWS-published xcframework. Bump both the URL version and checksum together
// by running:
//   swift package compute-checksum AmazonIVSBroadcast.xcframework.zip
//
// Distribution:
//   - SwiftPM (this manifest)
//   - CocoaPods (see SubstreamSDK.podspec)
//   - Prebuilt xcframework attached to GitHub Releases (see Scripts/build_xcframework.sh)

import PackageDescription

let package = Package(
    name: "SubstreamSDK",
    defaultLocalization: "en",
    platforms: [
        .iOS(.v14),
        // macOS is not a supported target for the SDK, but declaring it makes
        // `swift build` + unit tests run locally on developer laptops and on
        // macOS CI runners that don't have a full iOS simulator toolchain.
        // All iOS-only code paths are gated behind `#if canImport(UIKit)`.
        .macOS(.v11),
    ],
    products: [
        .library(
            name: "SubstreamSDK",
            targets: ["SubstreamSDK"]
        ),
    ],
    dependencies: [
        // No external source dependencies — AmazonIVSBroadcast is vendored as
        // a binary target below so consumers get a deterministic, signed build.
    ],
    targets: [
        // Public SDK
        .target(
            name: "SubstreamSDK",
            dependencies: [
                // Link AmazonIVSBroadcast as a weak/conditional dependency.
                // If present at build time, the SDK publishes via IVS. If
                // absent (simulators without GPU, CI linter runs), the SDK
                // still compiles and runs capture — it just won't publish.
                .target(name: "AmazonIVSBroadcastShim"),
            ],
            path: "Sources/SubstreamSDK",
            exclude: [
                "BroadcastExtension/README.md",
            ],
            resources: [
                .process("Resources/PrivacyInfo.xcprivacy"),
            ],
            swiftSettings: [
                // Strict concurrency turns Sendable / actor mistakes into
                // warnings — we promote to errors on CI via .github/workflows/ios.yml.
                .enableExperimentalFeature("StrictConcurrency"),
                .define("SUBSTREAM_SDK"),
            ]
        ),

        // Shim target that re-exports AmazonIVSBroadcast when available.
        // Consumers add the real binary target in their own Package.swift
        // (see README "Installation"), or pull via CocoaPods where the pod
        // spec expresses a hard dependency. This keeps `swift build` green
        // in a fresh checkout without requiring the 100MB binary download.
        .target(
            name: "AmazonIVSBroadcastShim",
            path: "Sources/AmazonIVSBroadcastShim"
        ),

        // Tests
        .testTarget(
            name: "SubstreamSDKTests",
            dependencies: ["SubstreamSDK"],
            path: "Tests/SubstreamSDKTests"
        ),
    ]
)
