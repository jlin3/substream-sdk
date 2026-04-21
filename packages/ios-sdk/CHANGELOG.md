# Changelog

All notable changes to **SubstreamSDK for iOS** are documented here. Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and [Semantic Versioning](https://semver.org/).

## [Unreleased]

### Added
- Initial public release of the native iOS SDK.
- `Substream.startStream(_:)` / `SubstreamSession` public API with parity to `@substream/web-sdk`.
- Capture sources: `MTKView`, `CAMetalLayer`, `SKView` (SpriteKit), `SCNView` (SceneKit), generic `UIView` fallback, in-app ReplayKit, and Broadcast Upload Extension helpers.
- Audio sources: `AVAudioEngine` mainMixer tap, microphone, ReplayKit audio sample buffers.
- Exponential-backoff reconnector, thermal / low-power adaptive bitrate, `AsyncStream<SubstreamEvent>` for stats.
- Privacy manifest (`PrivacyInfo.xcprivacy`) declaring Required Reason API usage.
- SwiftPM + CocoaPods + prebuilt xcframework distribution.
- Example SpriteKit app (`Example/SubstreamDemo`) with SwiftUI "Go Live" screen and Broadcast Upload Extension target.

[Unreleased]: https://github.com/jlin3/substream-sdk/compare/v1.0.0...HEAD
