import AVFoundation
import Combine
import Foundation
import Speech

@MainActor
final class OverlayViewModel: ObservableObject {
    @Published var isVisible = false
    @Published var isRecording = false
    @Published var transcript = ""
    @Published var editableText = ""
    @Published var hasUserEdited = false
    @Published var shouldFocusEditor = false
    @Published var microphoneStatus: AVAuthorizationStatus = .notDetermined
    @Published var speechStatus: SFSpeechRecognizerAuthorizationStatus = .notDetermined
    @Published var statusMessage: String?
    @Published var statusIsError = false

    var onSend: ((String) -> Void)?
    var onStop: (() -> Void)?
    var onCancel: (() -> Void)?

    func applyTranscript(_ text: String) {
        transcript = text
        if !hasUserEdited && (isRecording || editableText.isEmpty) {
            editableText = text
        }
    }

    func userDidEdit(_ text: String) {
        hasUserEdited = true
        editableText = text
    }

    func resetForRecording() {
        hasUserEdited = false
        transcript = ""
        editableText = ""
        statusMessage = nil
        statusIsError = false
    }

    func showStatus(_ message: String, isError: Bool) {
        statusMessage = message
        statusIsError = isError
    }
}
