Pod::Spec.new do |s|
    s.name             = 'SubstreamSDK'
    s.version          = '1.0.0'
    s.summary          = 'Add live streaming to any iOS game with 5 lines of Swift.'
    s.description      = <<-DESC
        SubstreamSDK is the native iOS SDK for the Substream streaming platform.
        It captures MTKView / CAMetalLayer / SpriteKit / SceneKit / UIView /
        ReplayKit / Broadcast Upload Extension frames and publishes them to
        AWS IVS Real-Time via the AmazonIVSBroadcast SDK, with sub-second
        glass-to-glass latency.

        Same backend contract as @substream/web-sdk.
    DESC

    s.homepage         = 'https://github.com/jlin3/substream-sdk'
    s.license          = { :type => 'MIT', :file => 'LICENSE' }
    s.author           = { 'Substream' => 'hello@substream.dev' }
    s.source           = {
        :git => 'https://github.com/jlin3/substream-sdk.git',
        :tag => "v#{s.version}"
    }

    s.ios.deployment_target = '14.0'
    s.swift_versions   = ['5.9']

    # SDK sources live under packages/ios-sdk in the monorepo.
    s.source_files     = 'packages/ios-sdk/Sources/SubstreamSDK/**/*.{swift}'
    s.exclude_files    = 'packages/ios-sdk/Sources/SubstreamSDK/BroadcastExtension/README.md'

    s.resource_bundles = {
        'SubstreamSDK' => ['packages/ios-sdk/Sources/SubstreamSDK/Resources/PrivacyInfo.xcprivacy']
    }

    # AmazonIVSBroadcast is distributed as an xcframework directly by AWS.
    # We pin to a known-good version and let CocoaPods fetch + embed it.
    s.dependency 'AmazonIVSBroadcast', '~> 1.25'

    s.frameworks = [
        'UIKit',
        'Metal',
        'MetalKit',
        'SpriteKit',
        'SceneKit',
        'AVFoundation',
        'CoreMedia',
        'CoreVideo',
        'ReplayKit',
        'QuartzCore'
    ]

    s.pod_target_xcconfig = {
        'DEFINES_MODULE' => 'YES',
        'OTHER_SWIFT_FLAGS' => '-DSUBSTREAM_SDK',
    }
end
