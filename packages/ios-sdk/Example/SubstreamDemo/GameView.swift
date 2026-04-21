import SpriteKit
import SwiftUI

/// SwiftUI wrapper around the Breakout SKView so we can compose it with the
/// "Go Live" button. Also exposes the underlying `SKView` via a binding so
/// the view model can point `SubstreamSDK.startStream(capture: .spriteKit(view))`.
struct GameView: UIViewRepresentable {

    @Binding var captureTarget: CaptureTarget

    func makeUIView(context: Context) -> SKView {
        let view = SKView(frame: .zero)
        view.ignoresSiblingOrder = true
        view.showsFPS = false
        view.showsNodeCount = false
        let scene = BreakoutScene(size: UIScreen.main.bounds.size)
        scene.scaleMode = .resizeFill
        view.presentScene(scene)
        DispatchQueue.main.async {
            captureTarget.skView = view
        }
        return view
    }

    func updateUIView(_ uiView: SKView, context: Context) {}
}

/// Container that lives on the view model side so we can hand a live SKView
/// reference to `SubstreamSDK.startStream(capture: .spriteKit(...))`.
final class CaptureTarget: ObservableObject {
    @Published var skView: SKView?
}
