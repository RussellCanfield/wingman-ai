import XCTest
@testable import WingmanMacKit

final class HotkeySettingsTests: XCTestCase {
    func testUsesSeparateStorageKeys() {
        let defaults = UserDefaults.standard
        defaults.removeObject(forKey: "wingman.hotkey.record.option")
        defaults.removeObject(forKey: "wingman.hotkey.overlay.option")

        let record = HotkeySettings(storageKey: "wingman.hotkey.record.option", defaultOption: .capsLock)
        let overlay = HotkeySettings(storageKey: "wingman.hotkey.overlay.option", defaultOption: .doubleShift)

        record.option = .doubleCommand
        overlay.option = .doubleOption

        let reloadedRecord = HotkeySettings(storageKey: "wingman.hotkey.record.option", defaultOption: .capsLock)
        let reloadedOverlay = HotkeySettings(storageKey: "wingman.hotkey.overlay.option", defaultOption: .doubleShift)

        XCTAssertEqual(reloadedRecord.option, .doubleCommand)
        XCTAssertEqual(reloadedOverlay.option, .doubleOption)
    }
}
