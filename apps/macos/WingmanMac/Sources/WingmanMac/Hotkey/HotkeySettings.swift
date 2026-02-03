import Foundation

final class HotkeySettings: ObservableObject {
    @Published var option: HotkeyOption {
        didSet {
            UserDefaults.standard.set(option.rawValue, forKey: Self.storageKey)
            onChange?(option)
        }
    }

    var onChange: ((HotkeyOption) -> Void)?
    private static let storageKey = "wingman.hotkey.option"

    init() {
        let stored = UserDefaults.standard.string(forKey: Self.storageKey)
        option = HotkeyOption(rawValue: stored ?? "") ?? .capsLock
    }
}
