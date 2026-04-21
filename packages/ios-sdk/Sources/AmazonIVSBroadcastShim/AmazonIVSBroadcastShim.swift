// AmazonIVSBroadcastShim
//
// Empty SwiftPM target whose sole job is to be a stable name for the SubstreamSDK
// library to depend on. When consumers install the real AmazonIVSBroadcast
// xcframework (via CocoaPods or a user-level SwiftPM binary target) the
// `#if canImport(AmazonIVSBroadcast)` guards throughout the SDK light up and
// IVS publishing is compiled in.
//
// Keeping this as a separate module means:
//   1. `swift build` on a bare checkout succeeds without downloading 100MB.
//   2. CI can run unit tests without a full iOS toolchain.
//   3. Consumer apps pick whichever installation path suits them (SwiftPM
//      binary target, CocoaPods, or manual xcframework drag-in).
//
// See packages/ios-sdk/README.md and SubstreamSDK.podspec for details.

@_exported import Foundation
