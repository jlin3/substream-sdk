// SilentAudioSource.swift
// No-op audio source used when `config.audioSource == .none` but audio is
// still enabled (e.g. for a stream with a muted local mixer).

import Foundation

final class SilentAudioSource: SubstreamAudioSource {
    func attach(sink: SubstreamAudioSink) {}
    func start() throws {}
    func stop() {}
}
