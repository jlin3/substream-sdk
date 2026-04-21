// StageStrategy.swift
// Implements AmazonIVSBroadcast's `IVSStageStrategy` so we publish our
// custom video + audio tracks and don't subscribe to remote participants.
//
// Isolated behind `#if canImport(AmazonIVSBroadcast)` so the rest of the SDK
// can still compile in CI environments that lack the binary target.

import Foundation

#if canImport(AmazonIVSBroadcast)
    import AmazonIVSBroadcast

    /// Publishes the given video + audio devices; never subscribes to others.
    final class SubstreamStageStrategy: NSObject, IVSStageStrategy {

        private let videoDevice: IVSCustomImageSource
        private let audioDevice: IVSCustomAudioSource?

        init(videoDevice: IVSCustomImageSource, audioDevice: IVSCustomAudioSource?) {
            self.videoDevice = videoDevice
            self.audioDevice = audioDevice
        }

        func stage(_ stage: IVSStage, streamsToPublishForParticipant participant: IVSParticipantInfo)
            -> [IVSLocalStageStream]
        {
            var streams: [IVSLocalStageStream] = [IVSLocalStageStream(device: videoDevice)]
            if let audio = audioDevice {
                streams.append(IVSLocalStageStream(device: audio))
            }
            return streams
        }

        func stage(_ stage: IVSStage, shouldPublishParticipant participant: IVSParticipantInfo) -> Bool {
            true
        }

        func stage(
            _ stage: IVSStage,
            shouldSubscribeToParticipant participant: IVSParticipantInfo
        ) -> IVSStageSubscribeType {
            .none
        }
    }
#endif
