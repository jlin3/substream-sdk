// CaptureSourceFactory.swift
// Factory that maps a `CaptureSource` enum case to the concrete image source
// implementation, and `AudioSource` to its concrete audio source.

import Foundation

#if canImport(UIKit)
    import UIKit
#endif
#if canImport(MetalKit)
    import MetalKit
#endif
#if canImport(SpriteKit)
    import SpriteKit
#endif
#if canImport(SceneKit)
    import SceneKit
#endif
#if canImport(QuartzCore)
    import QuartzCore
#endif

enum CaptureSourceFactory {

    static func makeImageSource(
        for capture: CaptureSource,
        targetFps: Int
    ) throws -> any SubstreamImageSource {

        switch capture {
        #if canImport(MetalKit)
            case .metalView(let view):
                return MTKViewCaptureSource(view: view, targetFps: targetFps)
        #endif

        #if canImport(QuartzCore)
            case .metalLayer(let layer):
                return MetalLayerCaptureSource(layer: layer, targetFps: targetFps)
        #endif

        #if canImport(SpriteKit) && canImport(UIKit)
            case .spriteKit(let view):
                return SpriteKitCaptureSource(view: view, targetFps: targetFps)
        #endif

        #if canImport(SceneKit) && canImport(UIKit)
            case .sceneKit(let view):
                return SceneKitCaptureSource(view: view, targetFps: targetFps)
        #endif

        #if canImport(UIKit)
            case .uiView(let view):
                return UIViewCaptureSource(view: view, targetFps: targetFps)
        #endif

        #if canImport(ReplayKit) && canImport(UIKit)
            case .replayKit:
                return ReplayKitInAppSource(targetFps: targetFps, includeMicrophone: true)

            case .broadcastExtension(let appGroup):
                return BroadcastExtensionBridgeSource(appGroup: appGroup, targetFps: targetFps)
        #endif
        }
    }

    static func makeAudioSource(
        for audio: AudioSource,
        capture: CaptureSource
    ) throws -> any SubstreamAudioSource {

        // ReplayKit + BroadcastExtension always bundle their own audio.
        #if canImport(ReplayKit) && canImport(UIKit)
            switch capture {
            case .replayKit, .broadcastExtension:
                return ReplayKitAudioSource()
            default: break
            }
        #endif

        switch audio {
        case .auto:
            #if canImport(AVFoundation)
                return MicrophoneAudioSource()
            #else
                throw SubstreamError.captureUnavailable("AVFoundation not available")
            #endif

        #if canImport(AVFoundation)
            case .gameAudioEngine(let engineRef):
                return GameAudioEngineTapSource(engine: engineRef.engine)
        #endif

        case .microphone:
            #if canImport(AVFoundation)
                return MicrophoneAudioSource()
            #else
                throw SubstreamError.captureUnavailable("Microphone unavailable")
            #endif

        case .none:
            return SilentAudioSource()

        case .replayKit:
            return ReplayKitAudioSource()
        }
    }
}
