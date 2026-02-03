import SwiftUI

struct RecordingOverlayView: View {
    @ObservedObject var viewModel: OverlayViewModel

    var body: some View {
        ZStack(alignment: .bottom) {
            Color.black.opacity(0.55)
                .ignoresSafeArea()

            VStack(spacing: 20) {
                permissionBanner

                VStack(spacing: 8) {
                    Text(viewModel.isRecording ? "Listening…" : "Review transcript")
                        .font(.system(size: 28, weight: .semibold))
                        .foregroundStyle(.white)

                    Text(viewModel.isRecording ? "Speak now" : "Edit before sending")
                        .font(.headline)
                        .foregroundStyle(.white.opacity(0.7))
                }

                AutoHidingTextEditor(
                    text: Binding(
                        get: { viewModel.editableText },
                        set: { viewModel.userDidEdit($0) }
                    ),
                    shouldFocus: $viewModel.shouldFocusEditor,
                    onTextChange: { viewModel.userDidEdit($0) }
                )
                .frame(maxWidth: 700, maxHeight: 150)
                .padding(16)
                .background(
                    ZStack {
                        RoundedRectangle(cornerRadius: 18, style: .continuous)
                            .fill(.ultraThinMaterial)
                        RoundedRectangle(cornerRadius: 18, style: .continuous)
                            .stroke(Color.white.opacity(0.18), lineWidth: 1)
                    }
                )
                .clipShape(RoundedRectangle(cornerRadius: 18, style: .continuous))
                .shadow(color: Color.black.opacity(0.35), radius: 18, x: 0, y: 10)
                .onTapGesture {
                    viewModel.shouldFocusEditor = true
                }

                HStack(spacing: 12) {
                    Button("Cancel") {
                        viewModel.onCancel?()
                    }
                    .buttonStyle(.bordered)

                    Button(viewModel.isRecording ? "Stop" : "Send") {
                        if viewModel.isRecording {
                            viewModel.onStop?()
                        } else {
                            viewModel.onSend?(viewModel.editableText)
                        }
                    }
                    .buttonStyle(.borderedProminent)
                    .disabled(!viewModel.isRecording && viewModel.editableText.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)
                }

                statusBanner
            }
            .padding(.bottom, 220)
            .padding(.horizontal, 48)

            WaveView()
                .frame(height: 260)
                .ignoresSafeArea(edges: .bottom)
                .allowsHitTesting(false)
        }
    }

    @ViewBuilder
    private var permissionBanner: some View {
        if let info = permissionInfo {
            Text(info.message)
                .font(.caption)
                .foregroundStyle(.white)
                .padding(.horizontal, 12)
                .padding(.vertical, 6)
                .background(info.color.opacity(0.85))
                .clipShape(Capsule())
        }
    }

    private var permissionInfo: (message: String, color: Color)? {
        if viewModel.microphoneStatus == .denied || viewModel.microphoneStatus == .restricted {
            return ("Microphone access is denied. Enable it in System Settings → Privacy & Security → Microphone.", .red)
        }
        if viewModel.speechStatus == .denied || viewModel.speechStatus == .restricted {
            return ("Speech recognition is denied. Enable it in System Settings → Privacy & Security → Speech Recognition.", .red)
        }
        if viewModel.microphoneStatus == .notDetermined || viewModel.speechStatus == .notDetermined {
            return ("Waiting for microphone/speech permissions…", .yellow)
        }
        return nil
    }

    @ViewBuilder
    private var statusBanner: some View {
        if let message = viewModel.statusMessage, !message.isEmpty {
            Text(message)
                .font(.caption)
                .foregroundStyle(.white)
                .padding(.horizontal, 12)
                .padding(.vertical, 6)
                .background((viewModel.statusIsError ? Color.red : Color.blue).opacity(0.85))
                .clipShape(Capsule())
        }
    }
}
