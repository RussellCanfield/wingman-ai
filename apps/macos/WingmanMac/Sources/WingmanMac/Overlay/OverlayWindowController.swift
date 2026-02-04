import AppKit
import Combine
import SwiftUI

@MainActor
final class OverlayWindowController: NSWindowController {
    private let viewModel = OverlayViewModel()
    private var speechManager: SpeechManager?
    private var gatewayService: GatewayService?
    private(set) var isVisible: Bool = false

    init() {
        let window = OverlayWindow(
            contentRect: .zero,
            styleMask: [.borderless],
            backing: .buffered,
            defer: false
        )
        window.isOpaque = false
        window.backgroundColor = .clear
        window.level = .screenSaver
        window.collectionBehavior = [.canJoinAllSpaces, .fullScreenAuxiliary]
        super.init(window: window)
        window.contentView = NSHostingView(rootView: RecordingOverlayView(viewModel: viewModel))
        window.makeKeyAndOrderFront(nil)
        window.orderOut(nil)
        setupCallbacks()
    }

    required init?(coder: NSCoder) {
        fatalError("init(coder:) has not been implemented")
    }

    func bind(speechManager: SpeechManager) {
        self.speechManager = speechManager
        speechManager.$transcript
            .receive(on: RunLoop.main)
            .sink { [weak self] text in
                self?.viewModel.applyTranscript(text)
            }
            .store(in: &subscriptions)

        speechManager.$isRecording
            .receive(on: RunLoop.main)
            .sink { [weak self] isRecording in
                self?.viewModel.isRecording = isRecording
                if isRecording {
                    self?.viewModel.resetForRecording()
                    self?.show(on: NSScreen.main)
                }
            }
            .store(in: &subscriptions)

        speechManager.$authorizationStatus
            .receive(on: RunLoop.main)
            .sink { [weak self] status in
                self?.viewModel.speechStatus = status
            }
            .store(in: &subscriptions)

        speechManager.$microphoneStatus
            .receive(on: RunLoop.main)
            .sink { [weak self] status in
                self?.viewModel.microphoneStatus = status
            }
            .store(in: &subscriptions)
    }

    func bind(gatewayService: GatewayService) {
        self.gatewayService = gatewayService
    }

    func show(on screen: NSScreen?) {
        guard let window = window else { return }
        if let screen {
            window.setFrame(screen.frame, display: true)
        }
        NSApp.activate(ignoringOtherApps: true)
        window.makeKeyAndOrderFront(nil)
        viewModel.isVisible = true
        isVisible = true
        viewModel.statusMessage = nil
        viewModel.statusIsError = false
        viewModel.shouldFocusEditor = true
    }

    func hide() {
        if speechManager?.isRecording == true {
            return
        }
        window?.orderOut(nil)
        viewModel.isVisible = false
        isVisible = false
    }

    func toggle(on screen: NSScreen?) {
        switch Self.toggleAction(isVisible: isVisible, isRecording: speechManager?.isRecording ?? false) {
        case .show:
            show(on: screen)
        case .hide:
            hide()
        case .noChange:
            break
        }
    }

    private var subscriptions: Set<AnyCancellable> = []

    private func setupCallbacks() {
        viewModel.onSend = { [weak self] text in
            guard let self else { return }
            self.speechManager?.stopRecording()
            guard let gatewayService = self.gatewayService else {
                self.viewModel.showStatus("Gateway is not configured.", isError: true)
                return
            }
            self.viewModel.showStatus("Sending to gateway…", isError: false)
            Task {
                do {
                    try await gatewayService.sendTranscript(text)
                    self.viewModel.showStatus("Sent to gateway.", isError: false)
                    self.hide()
                } catch {
                    self.viewModel.showStatus("Failed to send: \(error.localizedDescription)", isError: true)
                }
            }
        }
        viewModel.onStop = { [weak self] in
            self?.speechManager?.stopRecording()
        }
        viewModel.onCancel = { [weak self] in
            self?.speechManager?.stopRecording()
            self?.hide()
        }
    }
}

enum OverlayToggleAction: Equatable {
    case show
    case hide
    case noChange
}

extension OverlayWindowController {
    nonisolated static func toggleAction(isVisible: Bool, isRecording: Bool) -> OverlayToggleAction {
        if isVisible {
            return isRecording ? .noChange : .hide
        }
        return .show
    }
}
