import AppKit

enum HotkeyOption: String, CaseIterable, Identifiable {
    case capsLock
    case doubleControl
    case doubleOption
    case doubleCommand
    case doubleShift

    var id: String { rawValue }

    var displayName: String {
        switch self {
        case .capsLock:
            return "Caps Lock"
        case .doubleControl:
            return "Double-press Control"
        case .doubleOption:
            return "Double-press Option"
        case .doubleCommand:
            return "Double-press Command"
        case .doubleShift:
            return "Double-press Shift"
        }
    }

    var modifierKey: ModifierKey? {
        switch self {
        case .capsLock:
            return nil
        case .doubleControl:
            return .control
        case .doubleOption:
            return .option
        case .doubleCommand:
            return .command
        case .doubleShift:
            return .shift
        }
    }
}
