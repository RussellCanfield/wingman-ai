import AppKit

final class HotkeyManager {
    var onTrigger: (() -> Void)?

    private var monitor: Any?
    private var localMonitor: Any?
    private var option: HotkeyOption = .capsLock
    private var lastFlags: NSEvent.ModifierFlags = []
    private var detector = ModifierDoublePressDetector()

    deinit {
        stop()
    }

    func update(option: HotkeyOption) {
        self.option = option
        lastFlags = []
        detector.reset()
        start()
    }

    private func start() {
        stop()
        monitor = NSEvent.addGlobalMonitorForEvents(matching: .flagsChanged) { [weak self] event in
            self?.handleFlagsChanged(event)
        }
        localMonitor = NSEvent.addLocalMonitorForEvents(matching: .flagsChanged) { [weak self] event in
            self?.handleFlagsChanged(event)
            return event
        }
    }

    private func stop() {
        if let monitor {
            NSEvent.removeMonitor(monitor)
        }
        monitor = nil
        if let localMonitor {
            NSEvent.removeMonitor(localMonitor)
        }
        localMonitor = nil
    }

    private func handleFlagsChanged(_ event: NSEvent) {
        let flags = event.modifierFlags.intersection(.deviceIndependentFlagsMask)
        defer { lastFlags = flags }

        if option == .capsLock {
            if event.keyCode == 57 {
                onTrigger?()
            }
            return
        }

        guard let modifier = option.modifierKey else { return }
        guard modifier.keyCodes.contains(event.keyCode) else { return }

        let nowActive = flags.contains(flag(for: modifier))
        let wasActive = lastFlags.contains(flag(for: modifier))
        if nowActive && !wasActive {
            let timestamp = event.timestamp
            if detector.registerPress(for: modifier, at: timestamp) {
                onTrigger?()
            }
        }
    }

    private func flag(for modifier: ModifierKey) -> NSEvent.ModifierFlags {
        switch modifier {
        case .control:
            return .control
        case .option:
            return .option
        case .command:
            return .command
        case .shift:
            return .shift
        }
    }
}
