import XCTest
@testable import WingmanMacKit

final class OverlayWindowControllerToggleTests: XCTestCase {
    func testToggleShowsWhenHidden() {
        XCTAssertEqual(
            OverlayWindowController.toggleAction(isVisible: false, isRecording: false),
            .show
        )
    }

    func testToggleHidesWhenVisibleAndNotRecording() {
        XCTAssertEqual(
            OverlayWindowController.toggleAction(isVisible: true, isRecording: false),
            .hide
        )
    }

    func testToggleNoChangeWhenVisibleAndRecording() {
        XCTAssertEqual(
            OverlayWindowController.toggleAction(isVisible: true, isRecording: true),
            .noChange
        )
    }
}
