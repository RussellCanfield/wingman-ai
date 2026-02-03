import AppKit
import AVFoundation
import Speech

@MainActor
final class SpeechManager: ObservableObject {
    @Published var transcript: String = ""
    @Published var isRecording = false
    @Published var authorizationStatus: SFSpeechRecognizerAuthorizationStatus = .notDetermined
    @Published var microphoneStatus: AVAuthorizationStatus = AVCaptureDevice.authorizationStatus(for: .audio)

    private let audioEngine = AVAudioEngine()
    private var recognitionRequest: SFSpeechAudioBufferRecognitionRequest?
    private var recognitionTask: SFSpeechRecognitionTask?
    private let recognizer = SFSpeechRecognizer(locale: Locale(identifier: "en-US"))

    init() {
        authorizationStatus = SFSpeechRecognizer.authorizationStatus()
        microphoneStatus = AVCaptureDevice.authorizationStatus(for: .audio)
    }

    func preflightPermissions() {
        Task {
            _ = await requestMicrophoneAccessIfNeeded()
            _ = await requestAuthorizationIfNeeded()
        }
    }

    func startRecording() {
        guard !isRecording else { return }
        Task { await startRecordingAsync() }
    }

    func stopRecording() {
        guard isRecording else { return }
        isRecording = false
        audioEngine.stop()
        audioEngine.inputNode.removeTap(onBus: 0)
        recognitionRequest?.endAudio()
        recognitionTask?.cancel()
        recognitionTask = nil
        recognitionRequest = nil
    }

    private func resetTranscriptIfNeeded() {
        if transcript.isEmpty { return }
        transcript = ""
    }

    private func startRecordingAsync() async {
        let micAuthorized = await requestMicrophoneAccessIfNeeded()
        guard micAuthorized else {
            print("Microphone access not authorized")
            return
        }

        let authorized = await requestAuthorizationIfNeeded()
        guard authorized else {
            print("Speech recognition not authorized")
            return
        }
        guard let recognizer else {
            print("Speech recognizer unavailable for locale en-US")
            return
        }
        guard recognizer.isAvailable else {
            print("Speech recognizer is temporarily unavailable")
            return
        }
        resetTranscriptIfNeeded()

        let request = SFSpeechAudioBufferRecognitionRequest()
        request.shouldReportPartialResults = true
        request.taskHint = .dictation
        request.requiresOnDeviceRecognition = false
        recognitionRequest = request

        let inputNode = audioEngine.inputNode
        let recordingFormat = inputNode.outputFormat(forBus: 0)
        inputNode.removeTap(onBus: 0)
        inputNode.installTap(onBus: 0, bufferSize: 1024, format: recordingFormat) { [weak self] buffer, _ in
            self?.recognitionRequest?.append(buffer)
        }

        audioEngine.prepare()
        do {
            try audioEngine.start()
        } catch {
            print("Failed to start audio engine: \(error)")
            return
        }

        recognitionTask = recognizer.recognitionTask(with: request) { [weak self] result, error in
            guard let self else { return }
            if let result {
                Task { @MainActor in
                    self.transcript = result.bestTranscription.formattedString
                }
            }
            if error != nil {
                Task { @MainActor in
                    self.stopRecording()
                }
            }
        }

        isRecording = true
    }

    private func requestAuthorizationIfNeeded() async -> Bool {
        authorizationStatus = SFSpeechRecognizer.authorizationStatus()
        if authorizationStatus == .authorized { return true }
        if authorizationStatus == .denied || authorizationStatus == .restricted { return false }
        let status = await withCheckedContinuation { continuation in
            SFSpeechRecognizer.requestAuthorization { value in
                continuation.resume(returning: value)
            }
        }
        authorizationStatus = status
        return status == .authorized
    }

    private func requestMicrophoneAccessIfNeeded() async -> Bool {
        let status = AVCaptureDevice.authorizationStatus(for: .audio)
        microphoneStatus = status
        switch status {
        case .authorized:
            return true
        case .denied, .restricted:
            return false
        case .notDetermined:
            let granted = await withCheckedContinuation { continuation in
                AVCaptureDevice.requestAccess(for: .audio) { allowed in
                    continuation.resume(returning: allowed)
                }
            }
            microphoneStatus = AVCaptureDevice.authorizationStatus(for: .audio)
            return granted
        @unknown default:
            return false
        }
    }
}
