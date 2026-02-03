import XCTest
@testable import WingmanMacKit

final class GatewaySettingsTests: XCTestCase {
    func testDefaults() {
        let defaults = UserDefaults.standard
        defaults.removeObject(forKey: "wingman.gateway.url")
        defaults.removeObject(forKey: "wingman.gateway.token")
        defaults.removeObject(forKey: "wingman.gateway.password")
        defaults.removeObject(forKey: "wingman.gateway.agentId")
        defaults.removeObject(forKey: "wingman.gateway.sessionKey")

        let settings = GatewaySettings()
        XCTAssertEqual(settings.url, "ws://127.0.0.1:18789/ws")
        XCTAssertEqual(settings.token, "")
        XCTAssertEqual(settings.password, "")
        XCTAssertEqual(settings.agentId, "")
        XCTAssertEqual(settings.sessionKey, "")
    }

    func testPersistsUpdates() {
        let settings = GatewaySettings()
        settings.url = "ws://example:1234/ws"
        settings.token = "token-1"
        settings.password = "pass-1"
        settings.agentId = "agent-main"
        settings.sessionKey = "session-123"

        let reloaded = GatewaySettings()
        XCTAssertEqual(reloaded.url, "ws://example:1234/ws")
        XCTAssertEqual(reloaded.token, "token-1")
        XCTAssertEqual(reloaded.password, "pass-1")
        XCTAssertEqual(reloaded.agentId, "agent-main")
        XCTAssertEqual(reloaded.sessionKey, "session-123")
    }

    func testNormalizesWildcardHost() {
        let settings = GatewaySettings()
        settings.url = "ws://0.0.0.0:18789/ws"
        XCTAssertEqual(settings.resolvedURL?.absoluteString, "ws://127.0.0.1:18789/ws")
    }

    func testResolvesHttpBaseUrl() {
        let settings = GatewaySettings()
        settings.url = "ws://127.0.0.1:18789/ws"
        XCTAssertEqual(settings.resolvedHttpBaseURL?.absoluteString, "http://127.0.0.1:18789")
    }
}
