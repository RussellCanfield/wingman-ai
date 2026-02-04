import Foundation

final class HotkeySettings: ObservableObject {
    @Published var option: HotkeyOption {
        didSet {
            UserDefaults.standard.set(option.rawValue, forKey: storageKey)
            onChange?(option)
        }
    }

    var onChange: ((HotkeyOption) -> Void)?
    private let storageKey: String

    init(storageKey: String = "wingman.hotkey.option", defaultOption: HotkeyOption = .capsLock) {
        self.storageKey = storageKey
        let stored = UserDefaults.standard.string(forKey: storageKey)
        option = HotkeyOption(rawValue: stored ?? "") ?? defaultOption
    }
}
