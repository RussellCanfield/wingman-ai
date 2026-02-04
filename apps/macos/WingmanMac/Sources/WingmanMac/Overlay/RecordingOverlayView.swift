import SwiftUI

struct RecordingOverlayView: View {
    @ObservedObject var viewModel: OverlayViewModel

    var body: some View {
        GeometryReader { proxy in
            let cardWidth = max(360, proxy.size.width * 0.3)

            ZStack(alignment: .bottom) {
                Color.black.opacity(0.55)
                    .ignoresSafeArea()

                VStack(spacing: 20) {
                    Text("Wingman AI")
                        .font(.system(size: 14, weight: .semibold))
                        .foregroundStyle(.white.opacity(0.7))
                        .padding(.horizontal, 12)
                        .padding(.vertical, 6)
                        .background(Color.white.opacity(0.08))
                        .clipShape(Capsule())

                    permissionBanner

                    VStack(spacing: 8) {
                        Text(viewModel.isRecording ? "Listening…" : "Review transcript")
                            .font(.system(size: 28, weight: .semibold))
                            .foregroundStyle(.white)

                        Text(viewModel.isRecording ? "Speak now" : "Edit before sending")
                            .font(.headline)
                            .foregroundStyle(.white.opacity(0.7))
                    }

                    VStack(spacing: 0) {
                        ZStack(alignment: .topLeading) {
                            if viewModel.editableText.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
                                Text(viewModel.isRecording ? "Listening…" : "Ask Wingman…")
                                    .font(.system(size: 15, weight: .medium))
                                    .foregroundStyle(.white.opacity(0.35))
                                    .padding(.top, 6)
                                    .padding(.leading, 4)
                                    .allowsHitTesting(false)
                            }

                            AutoHidingTextEditor(
                                text: Binding(
                                    get: { viewModel.editableText },
                                    set: { viewModel.userDidEdit($0) }
                                ),
                                shouldFocus: $viewModel.shouldFocusEditor,
                                onTextChange: { viewModel.userDidEdit($0) }
                            )
                            .frame(maxWidth: .infinity, minHeight: 72, maxHeight: 150)
                        }
                        .padding(.horizontal, 18)
                        .padding(.top, 14)
                        .padding(.bottom, 10)

                        HStack(spacing: 12) {
                            Button {
                                viewModel.onCancel?()
                            } label: {
                                Label("Cancel", systemImage: "xmark")
                                    .font(.system(size: 13, weight: .semibold))
                            }
                            .buttonStyle(.plain)
                            .padding(.horizontal, 10)
                            .padding(.vertical, 6)
                            .background(Color.white.opacity(0.08))
                            .clipShape(Capsule())
                            .foregroundStyle(.white.opacity(0.85))

                            Spacer()

                            Button {
                                if viewModel.isRecording {
                                    viewModel.onStop?()
                                } else {
                                    viewModel.onSend?(viewModel.editableText)
                                }
                            } label: {
                                Image(systemName: viewModel.isRecording ? "stop.fill" : "arrow.up")
                                    .font(.system(size: 13, weight: .semibold))
                                    .foregroundStyle(.black)
                                    .frame(width: 28, height: 28)
                                    .background(Color.white)
                                    .clipShape(Circle())
                            }
                            .buttonStyle(.plain)
                            .disabled(!viewModel.isRecording && viewModel.editableText.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)
                            .opacity(!viewModel.isRecording && viewModel.editableText.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty ? 0.4 : 1.0)
                        }
                        .padding(.horizontal, 16)
                        .padding(.bottom, 14)
                    }
                    .frame(width: cardWidth)
                    .background(
                        ZStack {
                            RoundedRectangle(cornerRadius: 24, style: .continuous)
                                .fill(
                                    LinearGradient(
                                        colors: [Color.white.opacity(0.08), Color.white.opacity(0.04)],
                                        startPoint: .topLeading,
                                        endPoint: .bottomTrailing
                                    )
                                )
                                .background(Color.black.opacity(0.35))
                                .clipShape(RoundedRectangle(cornerRadius: 24, style: .continuous))
                            RoundedRectangle(cornerRadius: 24, style: .continuous)
                                .stroke(Color.white.opacity(0.14), lineWidth: 1)
                        }
                    )
                    .clipShape(RoundedRectangle(cornerRadius: 24, style: .continuous))
                    .shadow(color: Color.black.opacity(0.45), radius: 24, x: 0, y: 14)
                    .onTapGesture {
                        viewModel.shouldFocusEditor = true
                    }

                    statusBanner
                }
                .frame(maxWidth: .infinity)
                .padding(.bottom, 220)

                if viewModel.isRecording {
                    WaveView()
                        .frame(height: 260)
                        .ignoresSafeArea(edges: .bottom)
                        .allowsHitTesting(false)
                }
            }
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
