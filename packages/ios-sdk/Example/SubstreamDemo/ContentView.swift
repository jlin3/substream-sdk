import SwiftUI

struct ContentView: View {
    @StateObject private var viewModel = GoLiveViewModel()
    @StateObject private var target = CaptureTarget()

    var body: some View {
        ZStack(alignment: .top) {
            GameView(captureTarget: .constant(target))
                .ignoresSafeArea()

            VStack(spacing: 12) {
                statusBadge
                if !viewModel.statsLine.isEmpty {
                    Text(viewModel.statsLine)
                        .font(.caption.monospaced())
                        .foregroundColor(.white.opacity(0.8))
                }
            }
            .padding(.top, 20)

            VStack {
                Spacer()
                goLiveButton
                    .padding(.bottom, 40)
            }
        }
        .preferredColorScheme(.dark)
    }

    private var statusBadge: some View {
        switch viewModel.status {
        case .idle:
            return AnyView(
                Label("Tap Go Live to stream", systemImage: "dot.radiowaves.left.and.right")
                    .labelStyle(.titleOnly)
                    .foregroundColor(.white.opacity(0.7))
                    .font(.caption)
            )
        case .connecting:
            return AnyView(
                Label("Connecting…", systemImage: "antenna.radiowaves.left.and.right")
                    .foregroundColor(.yellow)
                    .font(.caption.bold())
            )
        case .live(let url):
            return AnyView(
                VStack(spacing: 4) {
                    Label("LIVE", systemImage: "record.circle.fill")
                        .foregroundColor(.red)
                        .font(.headline)
                    Link(url.absoluteString, destination: url)
                        .font(.caption.monospaced())
                        .tint(.blue)
                }
            )
        case .stopping:
            return AnyView(
                Text("Stopping…").foregroundColor(.orange).font(.caption)
            )
        case .error(let msg):
            return AnyView(
                Text("Error: \(msg)").foregroundColor(.red).font(.caption).lineLimit(3)
            )
        }
    }

    @ViewBuilder
    private var goLiveButton: some View {
        switch viewModel.status {
        case .live:
            Button {
                Task { await viewModel.stop() }
            } label: {
                Label("Stop", systemImage: "stop.circle.fill")
                    .padding(.horizontal, 24).padding(.vertical, 12)
                    .background(Color.red).foregroundColor(.white)
                    .clipShape(Capsule())
            }
        case .connecting, .stopping:
            ProgressView().tint(.white)
        default:
            Button {
                guard let view = target.skView else { return }
                Task { await viewModel.goLive(skView: view) }
            } label: {
                Label("Go Live", systemImage: "dot.radiowaves.left.and.right")
                    .padding(.horizontal, 24).padding(.vertical, 12)
                    .background(Color.white).foregroundColor(.black)
                    .clipShape(Capsule())
            }
            .disabled(target.skView == nil)
        }
    }
}
