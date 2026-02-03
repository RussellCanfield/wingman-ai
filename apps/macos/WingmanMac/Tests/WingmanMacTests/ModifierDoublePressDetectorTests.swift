import XCTest
@testable import WingmanMacKit

final class ModifierDoublePressDetectorTests: XCTestCase {
    func testDetectsDoublePressWithinThreshold() {
        let detector = ModifierDoublePressDetector(threshold: 0.5)
        XCTAssertFalse(detector.registerPress(for: .control, at: 0.0))
        XCTAssertTrue(detector.registerPress(for: .control, at: 0.3))
    }

    func testDoesNotTriggerOutsideThreshold() {
        let detector = ModifierDoublePressDetector(threshold: 0.2)
        XCTAssertFalse(detector.registerPress(for: .option, at: 0.0))
        XCTAssertFalse(detector.registerPress(for: .option, at: 0.4))
    }

    func testResetsAfterTrigger() {
        let detector = ModifierDoublePressDetector(threshold: 0.5)
        XCTAssertFalse(detector.registerPress(for: .command, at: 0.0))
        XCTAssertTrue(detector.registerPress(for: .command, at: 0.4))
        XCTAssertFalse(detector.registerPress(for: .command, at: 0.6))
    }
}
