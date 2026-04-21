import Combine
import Foundation
import SpriteKit
import SubstreamSDK

@MainActor
final class GoLiveViewModel: ObservableObject {

    enum Status: Equatable {
        case idle
        case connecting
        case live(viewerUrl: URL)
        case stopping
        case error(String)
    }

    @Published var status: Status = .idle
    @Published var statsLine: String = ""

    private var session: SubstreamSession?
    private var eventsTask: Task<Void, Never>?

    // Demo credentials — same as the web demo. Replace in your own app.
    let backendUrl = URL(string: "https://substream-sdk-production.up.railway.app")!
    let authToken = "demo-token"
    let streamerId = "demo-child-001"

    func goLive(skView: SKView) async {
        await stop() // ensure clean slate

        status = .connecting
        do {
            let session = try await Substream.startStream(
                .init(
                    backendUrl: backendUrl,
                    authToken: authToken,
                    streamerId: streamerId,
                    capture: .spriteKit(skView),
                    streamerName: "iOS Demo Player",
                    title: "Breakout on iPhone"
                )
            )
            self.session = session
            self.status = .live(viewerUrl: session.viewerUrl)

            eventsTask = Task { [weak self] in
                for await event in session.events {
                    await self?.handle(event: event)
                }
            }
        } catch {
            self.status = .error(String(describing: error))
        }
    }

    func stop() async {
        guard let session else {
            status = .idle
            return
        }
        status = .stopping
        await session.stop()
        self.session = nil
        eventsTask?.cancel()
        eventsTask = nil
        status = .idle
        statsLine = ""
    }

    private func handle(event: SubstreamEvent) {
        switch event {
        case .connecting:
            status = .connecting
        case .live(let info):
            status = .live(viewerUrl: info.viewerUrl)
        case .statsUpdated(let s):
            statsLine = "\(s.bitrateKbps) kbps · \(s.fps) fps · \(s.health.rawValue)"
        case .reconnecting(let n):
            statsLine = "reconnecting (attempt \(n))"
        case .stopped:
            status = .idle
            statsLine = ""
        case .warning(let msg):
            statsLine = msg
        }
    }
}
