import Foundation

enum ModifierKey: CaseIterable {
    case control
    case option
    case command
    case shift

    var keyCodes: Set<UInt16> {
        switch self {
        case .control:
            return [59, 62]
        case .option:
            return [58, 61]
        case .command:
            return [55, 54]
        case .shift:
            return [56, 60]
        }
    }
}

final class ModifierDoublePressDetector {
    private var lastPress: [ModifierKey: TimeInterval] = [:]
    private let threshold: TimeInterval

    init(threshold: TimeInterval = 0.35) {
        self.threshold = threshold
    }

    func registerPress(for key: ModifierKey, at timestamp: TimeInterval) -> Bool {
        if let last = lastPress[key], timestamp - last <= threshold {
            lastPress[key] = nil
            return true
        }
        lastPress[key] = timestamp
        return false
    }

    func reset() {
        lastPress.removeAll()
    }
}
