import AVFoundation
import Foundation
import Speech
import UserNotifications

func argumentValue(_ name: String) -> String? {
	let args = CommandLine.arguments
	guard let index = args.firstIndex(of: name) else {
		return nil
	}
	let next = index + 1
	guard next < args.count else {
		return nil
	}
	return args[next]
}

func writePidFileIfRequested() {
	guard let pidFile = argumentValue("--pid-file") else {
		return
	}
	let pidText = "\(ProcessInfo.processInfo.processIdentifier)\n"
	do {
		let url = URL(fileURLWithPath: pidFile)
		try pidText.data(using: .utf8)?.write(to: url, options: .atomic)
	} catch {
		// Keep bridge startup resilient; PID file is best effort.
	}
}

func emit(_ type: String, _ message: String) {
	FileHandle.standardOutput.write(Data("\(type)\t\(message)\n".utf8))
}

func microphoneAuthorizationStatusString() -> String {
	let status = AVCaptureDevice.authorizationStatus(for: .audio)
	switch status {
	case .authorized:
		return "authorized"
	case .denied:
		return "denied"
	case .restricted:
		return "restricted"
	case .notDetermined:
		return "notDetermined"
	@unknown default:
		return "notDetermined"
	}
}

func speechAuthorizationStatusString() -> String {
	let status = SFSpeechRecognizer.authorizationStatus()
	switch status {
	case .authorized:
		return "authorized"
	case .denied:
		return "denied"
	case .restricted:
		return "restricted"
	case .notDetermined:
		return "notDetermined"
	@unknown default:
		return "notDetermined"
	}
}

func notificationAuthorizationStatusString() -> String {
	let center = UNUserNotificationCenter.current()
	let semaphore = DispatchSemaphore(value: 0)
	var resolved = "notDetermined"
	center.getNotificationSettings { settings in
		switch settings.authorizationStatus {
		case .authorized:
			resolved = "authorized"
		case .denied:
			resolved = "denied"
		case .notDetermined:
			resolved = "notDetermined"
		case .provisional:
			resolved = "provisional"
		case .ephemeral:
			resolved = "ephemeral"
		@unknown default:
			resolved = "notDetermined"
		}
		semaphore.signal()
	}
	_ = semaphore.wait(timeout: .now() + .seconds(10))
	return resolved
}

func runPermissionProbeMode() -> Int32 {
	let payload: [String: String] = [
		"microphone": microphoneAuthorizationStatusString(),
		"speech": speechAuthorizationStatusString(),
		"notifications": notificationAuthorizationStatusString(),
	]
	do {
		let data = try JSONSerialization.data(withJSONObject: payload, options: [])
		if let json = String(data: data, encoding: .utf8) {
			FileHandle.standardOutput.write(Data("\(json)\n".utf8))
			return 0
		}
		FileHandle.standardError.write(Data("failed to encode probe payload\n".utf8))
		return 1
	} catch {
		FileHandle.standardError.write(Data("failed to encode probe payload: \(error.localizedDescription)\n".utf8))
		return 1
	}
}

func runSendTestNotificationMode() -> Int32 {
	let center = UNUserNotificationCenter.current()
	let authSemaphore = DispatchSemaphore(value: 0)
	var granted = false
	var authError: Error?
	center.requestAuthorization(options: [.alert, .sound, .badge]) { allowed, error in
		granted = allowed
		authError = error
		authSemaphore.signal()
	}
	_ = authSemaphore.wait(timeout: .now() + .seconds(10))
	if let authError {
		FileHandle.standardError.write(Data("notification authorization failed: \(authError.localizedDescription)\n".utf8))
		return 1
	}
	guard granted else {
		FileHandle.standardError.write(Data("notification authorization denied\n".utf8))
		return 1
	}

	let content = UNMutableNotificationContent()
	content.title = "Wingman Desktop"
	content.body = "Notifications are enabled and working."
	content.sound = .default
	let request = UNNotificationRequest(
		identifier: "wingman-desktop-test-\(UUID().uuidString)",
		content: content,
		trigger: UNTimeIntervalNotificationTrigger(timeInterval: 1, repeats: false)
	)
	let addSemaphore = DispatchSemaphore(value: 0)
	var addError: Error?
	center.add(request) { error in
		addError = error
		addSemaphore.signal()
	}
	_ = addSemaphore.wait(timeout: .now() + .seconds(10))
	if let addError {
		FileHandle.standardError.write(Data("failed to schedule test notification: \(addError.localizedDescription)\n".utf8))
		return 1
	}
	return 0
}

final class SpeechBridge {
	private let audioEngine = AVAudioEngine()
	private let recognizer = SFSpeechRecognizer(locale: Locale(identifier: "en_US"))
	private var request: SFSpeechAudioBufferRecognitionRequest?
	private var task: SFSpeechRecognitionTask?
	private var stopping = false

	func start() throws {
		guard let recognizer else {
			emit("ERROR", "speech-recognizer-unavailable")
			throw NSError(domain: "SpeechBridge", code: 1)
		}

		emit("STATUS", "Requesting permissions...")
		let speechStatus = requestSpeechAuthorization()
		guard speechStatus == .authorized else {
			emit("ERROR", "speech-authorization-\(speechStatus.rawValue)")
			throw NSError(domain: "SpeechBridge", code: 2)
		}

		let microphoneAllowed = requestMicrophoneAccess()
		guard microphoneAllowed else {
			emit("ERROR", "microphone-denied")
			throw NSError(domain: "SpeechBridge", code: 3)
		}

		stopping = false

		let request = SFSpeechAudioBufferRecognitionRequest()
		request.shouldReportPartialResults = true
		self.request = request

		task = recognizer.recognitionTask(with: request) { result, error in
			if let result {
				let text = result.bestTranscription.formattedString
				if result.isFinal {
					emit("FINAL", text)
				} else {
					emit("PARTIAL", text)
				}
			}

			if let error {
				let description = error.localizedDescription
				let normalized = description.lowercased()
				let isExpectedStop = self.stopping || normalized.contains("canceled") || normalized.contains("cancelled")
				if isExpectedStop {
					emit("STATUS", "Stopped")
				} else {
					emit("ERROR", "recognition-error-\(description)")
				}
			}
		}

		let inputNode = audioEngine.inputNode
		inputNode.removeTap(onBus: 0)
		let format = inputNode.outputFormat(forBus: 0)
		inputNode.installTap(onBus: 0, bufferSize: 1024, format: format) { [weak self] buffer, _ in
			self?.request?.append(buffer)
		}

		audioEngine.prepare()
		try audioEngine.start()
		emit("STATUS", "Listening...")
	}

	func stop() {
		stopping = true
		audioEngine.stop()
		audioEngine.inputNode.removeTap(onBus: 0)
		request?.endAudio()
		task?.cancel()
		emit("STATUS", "Stopped")
	}

	private func requestSpeechAuthorization() -> SFSpeechRecognizerAuthorizationStatus {
		let semaphore = DispatchSemaphore(value: 0)
		var resolvedStatus: SFSpeechRecognizerAuthorizationStatus = .notDetermined
		SFSpeechRecognizer.requestAuthorization { status in
			resolvedStatus = status
			semaphore.signal()
		}
		_ = semaphore.wait(timeout: .now() + .seconds(15))
		return resolvedStatus
	}

	private func requestMicrophoneAccess() -> Bool {
		let semaphore = DispatchSemaphore(value: 0)
		var allowed = false
		AVCaptureDevice.requestAccess(for: .audio) { granted in
			allowed = granted
			semaphore.signal()
		}
		_ = semaphore.wait(timeout: .now() + .seconds(15))
		return allowed
	}
}

let bridge = SpeechBridge()

signal(SIGINT, SIG_IGN)
signal(SIGTERM, SIG_IGN)

if CommandLine.arguments.contains("--probe-permissions") {
	exit(runPermissionProbeMode())
}

if CommandLine.arguments.contains("--send-test-notification") {
	exit(runSendTestNotificationMode())
}

let signalQueue = DispatchQueue(label: "wingman.speech.signals")
let intSource = DispatchSource.makeSignalSource(signal: SIGINT, queue: signalQueue)
let termSource = DispatchSource.makeSignalSource(signal: SIGTERM, queue: signalQueue)

let shutdown: () -> Void = {
	bridge.stop()
	CFRunLoopStop(CFRunLoopGetMain())
}

intSource.setEventHandler(handler: shutdown)
termSource.setEventHandler(handler: shutdown)
intSource.resume()
termSource.resume()

do {
	writePidFileIfRequested()
	try bridge.start()
	RunLoop.main.run()
} catch {
	emit("ERROR", "bridge-start-failed-\(error.localizedDescription)")
	exit(1)
}
