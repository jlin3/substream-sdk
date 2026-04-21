import SubstreamSDK

/// Drop-in Broadcast Upload Extension handler.
///
/// SubstreamSDK's `SubstreamBroadcastHandler` does all the heavy lifting —
/// we just declare which App Group we share with the host app.
class SampleHandler: SubstreamBroadcastHandler {
    override var appGroup: String { "group.dev.substream.demo" }
    override var targetFps: Int { 30 }
}
