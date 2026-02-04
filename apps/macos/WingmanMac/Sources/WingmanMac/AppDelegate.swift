import AppKit
import Foundation
import SwiftUI

@MainActor
public final class AppDelegate: NSObject, NSApplicationDelegate, NSWindowDelegate {
    private var statusItem: NSStatusItem?
    private let overlayController = OverlayWindowController()
    private let speechManager = SpeechManager()
    private let recordHotkeyManager = HotkeyManager()
    private let overlayHotkeyManager = HotkeyManager()
    let recordHotkeySettings = HotkeySettings(storageKey: "wingman.hotkey.record.option", defaultOption: .capsLock)
    let overlayHotkeySettings = HotkeySettings(storageKey: "wingman.hotkey.overlay.option", defaultOption: .doubleShift)
    let gatewaySettings = GatewaySettings()
    private lazy var gatewayService = GatewayService(settings: gatewaySettings)
    private var settingsWindow: NSWindow?
    private var settingsStatusMessage: String?
    private var settingsStatusIsError = false
    private var sessionsStatusMessage: String?
    private var sessionsStatusIsError = false
    private var sessionsLoading = false
    private var sessionSummaries: [GatewaySessionSummary] = []

    public override init() {
        super.init()
    }

    public func applicationDidFinishLaunching(_ notification: Notification) {
        setupStatusItem()
        wireUpHotkeys()
        overlayController.bind(speechManager: speechManager)
        overlayController.bind(gatewayService: gatewayService)
        speechManager.preflightPermissions()
    }

    private func setupStatusItem() {
        let item = NSStatusBar.system.statusItem(withLength: NSStatusItem.squareLength)
        if let button = item.button {
            button.image = NSImage(systemSymbolName: "waveform", accessibilityDescription: "Wingman AI")
        }
        let menu = NSMenu()
        menu.addItem(NSMenuItem(title: "Start Recording", action: #selector(toggleRecording), keyEquivalent: ""))
        menu.addItem(NSMenuItem(title: "Toggle Overlay", action: #selector(toggleOverlay), keyEquivalent: ""))
        menu.addItem(NSMenuItem(title: "Open Gateway UI", action: #selector(openGatewayUI), keyEquivalent: ""))
        menu.addItem(NSMenuItem.separator())
        menu.addItem(NSMenuItem(title: "Settings…", action: #selector(openSettings), keyEquivalent: ","))
        menu.addItem(NSMenuItem(title: "Quit Wingman AI", action: #selector(quit), keyEquivalent: "q"))
        item.menu = menu
        statusItem = item
    }

    private func wireUpHotkeys() {
        recordHotkeyManager.onTrigger = { [weak self] in
            self?.toggleRecording()
        }
        recordHotkeySettings.onChange = { [weak self] option in
            self?.recordHotkeyManager.update(option: option)
        }
        recordHotkeyManager.update(option: recordHotkeySettings.option)

        overlayHotkeyManager.onTrigger = { [weak self] in
            self?.toggleOverlay()
        }
        overlayHotkeySettings.onChange = { [weak self] option in
            self?.overlayHotkeyManager.update(option: option)
        }
        overlayHotkeyManager.update(option: overlayHotkeySettings.option)
    }

    @objc private func toggleRecording() {
        if speechManager.isRecording {
            speechManager.stopRecording()
            overlayController.hide()
        } else {
            speechManager.startRecording()
            overlayController.show(on: NSScreen.main)
        }
    }

    @objc private func toggleOverlay() {
        overlayController.toggle(on: NSScreen.main)
    }

    @objc private func openGatewayUI() {
        guard let url = gatewaySettings.resolvedHttpBaseURL else {
            let alert = NSAlert()
            alert.messageText = "Gateway URL is missing"
            alert.informativeText = "Set a Gateway URL in Settings to open the web UI."
            alert.alertStyle = .warning
            alert.runModal()
            return
        }
        NSWorkspace.shared.open(url)
    }

    @objc private func openSettings() {
        if settingsWindow == nil {
            let view = SettingsView(
                recordSettings: recordHotkeySettings,
                overlaySettings: overlayHotkeySettings,
                gatewaySettings: gatewaySettings,
                onTestGateway: { [weak self] in
                    self?.runGatewayTest()
                },
                onLoadSessions: { [weak self] in
                    self?.runSessionsLoad()
                },
                onSelectSession: { [weak self] session in
                    self?.applySessionSelection(session)
                },
                statusMessage: settingsStatusMessage,
                statusIsError: settingsStatusIsError,
                sessions: sessionSummaries,
                sessionsLoading: sessionsLoading,
                sessionsStatusMessage: sessionsStatusMessage,
                sessionsStatusIsError: sessionsStatusIsError
            )
            let window = NSWindow(
                contentRect: NSRect(x: 0, y: 0, width: 720, height: 520),
                styleMask: [.titled, .closable, .miniaturizable],
                backing: .buffered,
                defer: false
            )
            window.title = "Wingman AI Settings"
            window.delegate = self
            window.isReleasedWhenClosed = false
            window.center()
            window.contentView = NSHostingView(rootView: view)
            settingsWindow = window
        }
        NSApp.activate(ignoringOtherApps: true)
        settingsWindow?.makeKeyAndOrderFront(nil)
    }

    @objc private func quit() {
        NSApp.terminate(nil)
    }

    private func runGatewayTest() {
        Task { @MainActor in
            settingsStatusMessage = "Testing…"
            settingsStatusIsError = false
            refreshSettingsWindow()
        }

        Task {
            do {
                try await gatewayService.testConnection()
                await MainActor.run {
                    settingsStatusMessage = "Connected"
                    settingsStatusIsError = false
                    refreshSettingsWindow()
                }
            } catch {
                await MainActor.run {
                    settingsStatusMessage = "Failed: \(error.localizedDescription)"
                    settingsStatusIsError = true
                    refreshSettingsWindow()
                }
            }
        }
    }

    private func refreshSettingsWindow() {
        guard let window = settingsWindow else { return }
        let view = SettingsView(
            recordSettings: recordHotkeySettings,
            overlaySettings: overlayHotkeySettings,
            gatewaySettings: gatewaySettings,
            onTestGateway: { [weak self] in
                self?.runGatewayTest()
            },
            onLoadSessions: { [weak self] in
                self?.runSessionsLoad()
            },
            onSelectSession: { [weak self] session in
                self?.applySessionSelection(session)
            },
            statusMessage: settingsStatusMessage,
            statusIsError: settingsStatusIsError,
            sessions: sessionSummaries,
            sessionsLoading: sessionsLoading,
            sessionsStatusMessage: sessionsStatusMessage,
            sessionsStatusIsError: sessionsStatusIsError
        )
        window.contentView = NSHostingView(rootView: view)
    }

    public func windowShouldClose(_ sender: NSWindow) -> Bool {
        if sender == settingsWindow {
            sender.orderOut(nil)
            return false
        }
        return true
    }

    private func runSessionsLoad() {
        Task { @MainActor in
            sessionsLoading = true
            sessionsStatusMessage = "Loading sessions…"
            sessionsStatusIsError = false
            refreshSettingsWindow()
        }

        Task {
            do {
                let sessions = try await gatewayService.fetchSessions(limit: 20, agentId: gatewaySettings.resolvedAgentId)
                await MainActor.run {
                    sessionSummaries = sessions
                    sessionsLoading = false
                    sessionsStatusMessage = sessions.isEmpty ? "No sessions found." : "Loaded \(sessions.count) sessions."
                    sessionsStatusIsError = false
                    refreshSettingsWindow()
                }
            } catch {
                await MainActor.run {
                    sessionsLoading = false
                    sessionsStatusMessage = "Failed: \(error.localizedDescription)"
                    sessionsStatusIsError = true
                    refreshSettingsWindow()
                }
            }
        }
    }

    private func applySessionSelection(_ session: GatewaySessionSummary) {
        gatewaySettings.agentId = session.agentId
        gatewaySettings.sessionKey = session.id
        refreshSettingsWindow()
    }
}

final class GatewaySettings: ObservableObject {
    @Published var url: String {
        didSet { store(url, key: Self.urlKey) }
    }
    @Published var uiURL: String {
        didSet { store(uiURL, key: Self.uiUrlKey) }
    }
    @Published var token: String {
        didSet { store(token, key: Self.tokenKey) }
    }
    @Published var password: String {
        didSet { store(password, key: Self.passwordKey) }
    }
    @Published var agentId: String {
        didSet { store(agentId, key: Self.agentIdKey) }
    }
    @Published var sessionKey: String {
        didSet { store(sessionKey, key: Self.sessionKeyKey) }
    }

    private static let urlKey = "wingman.gateway.url"
    private static let uiUrlKey = "wingman.gateway.uiUrl"
    private static let tokenKey = "wingman.gateway.token"
    private static let passwordKey = "wingman.gateway.password"
    private static let agentIdKey = "wingman.gateway.agentId"
    private static let sessionKeyKey = "wingman.gateway.sessionKey"

    init() {
        let defaults = UserDefaults.standard
        url = defaults.string(forKey: Self.urlKey) ?? "ws://127.0.0.1:18789/ws"
        uiURL = defaults.string(forKey: Self.uiUrlKey) ?? ""
        token = defaults.string(forKey: Self.tokenKey) ?? ""
        password = defaults.string(forKey: Self.passwordKey) ?? ""
        agentId = defaults.string(forKey: Self.agentIdKey) ?? ""
        sessionKey = defaults.string(forKey: Self.sessionKeyKey) ?? ""
    }

    var resolvedToken: String? {
        trimmedOrNil(token)
    }

    var resolvedPassword: String? {
        trimmedOrNil(password)
    }

    var resolvedAgentId: String? {
        trimmedOrNil(agentId)
    }

    var resolvedSessionKey: String? {
        trimmedOrNil(sessionKey)
    }

    var resolvedURL: URL? {
        let trimmed = url.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else { return nil }
        return normalizedURL(from: trimmed)
    }

    var resolvedUIURL: URL? {
        let trimmed = uiURL.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else { return nil }
        return normalizedURL(from: trimmed)
    }

    var resolvedHttpBaseURL: URL? {
        if let uiOverride = resolvedUIURL {
            return uiOverride
        }
        guard let wsURL = resolvedURL else { return nil }
        guard var components = URLComponents(url: wsURL, resolvingAgainstBaseURL: false) else {
            return nil
        }
        switch components.scheme {
        case "wss":
            components.scheme = "https"
        case "ws":
            components.scheme = "http"
        default:
            break
        }
        if components.path.hasSuffix("/ws") {
            components.path = String(components.path.dropLast(3))
        }
        return components.url
    }

    private func normalizedURL(from value: String) -> URL? {
        guard var components = URLComponents(string: value) else { return nil }
        if components.host == "0.0.0.0" {
            components.host = "127.0.0.1"
        }
        return components.url
    }

    private func store(_ value: String, key: String) {
        UserDefaults.standard.set(value, forKey: key)
    }

    private func trimmedOrNil(_ value: String) -> String? {
        let trimmed = value.trimmingCharacters(in: .whitespacesAndNewlines)
        return trimmed.isEmpty ? nil : trimmed
    }
}

enum GatewayClientError: LocalizedError {
    case invalidResponse
    case authenticationFailed(String)
    case invalidMessage
    case missingURL
    case timeout
    case invalidHttpResponse

    var errorDescription: String? {
        switch self {
        case .invalidResponse:
            return "Invalid gateway response"
        case .authenticationFailed(let message):
            return message
        case .invalidMessage:
            return "Invalid gateway message"
        case .missingURL:
            return "Gateway URL is missing"
        case .timeout:
            return "Gateway connection timed out"
        case .invalidHttpResponse:
            return "Invalid gateway HTTP response"
        }
    }
}

final class GatewayClient {
    private let url: URL
    private let token: String?
    private let password: String?
    private let session: URLSession
    private var task: URLSessionWebSocketTask?

    init(url: URL, token: String?, password: String?) {
        self.url = url
        self.token = token
        self.password = password
        self.session = URLSession(configuration: .default)
    }

    func connect() async throws {
        if task != nil { return }
        let task = session.webSocketTask(with: url)
        self.task = task
        task.resume()

        let connectId = UUID().uuidString
        var message: [String: Any] = [
            "type": "connect",
            "id": connectId,
            "client": [
                "instanceId": "macos-\(Int(Date().timeIntervalSince1970))",
                "clientType": "macos",
            ],
            "timestamp": Int(Date().timeIntervalSince1970 * 1000),
        ]
        var auth: [String: String] = [:]
        if let token, !token.isEmpty {
            auth["token"] = token
        }
        if let password, !password.isEmpty {
            auth["password"] = password
        }
        if !auth.isEmpty {
            message["auth"] = auth
        }

        try await send(message: message)

        let response = try await waitForResponse(id: connectId)
        guard let ok = response["ok"] as? Bool else {
            throw GatewayClientError.invalidResponse
        }
        if !ok {
            let message = response["payload"] as? String ?? "Gateway authentication failed"
            throw GatewayClientError.authenticationFailed(message)
        }
    }

    func sendAgentRequest(content: String, agentId: String? = nil, sessionKey: String? = nil) async throws {
        guard let task else {
            throw GatewayClientError.invalidResponse
        }
        let requestId = UUID().uuidString
        var payload: [String: Any] = ["content": content]
        if let agentId, !agentId.isEmpty {
            payload["agentId"] = agentId
        }
        if let sessionKey, !sessionKey.isEmpty {
            payload["sessionKey"] = sessionKey
        }
        let message: [String: Any] = [
            "type": "req:agent",
            "id": requestId,
            "payload": payload,
            "timestamp": Int(Date().timeIntervalSince1970 * 1000),
        ]
        try await send(message: message, task: task)
    }

    func disconnect() {
        task?.cancel(with: .goingAway, reason: nil)
        task = nil
    }

    private func send(message: [String: Any], task: URLSessionWebSocketTask? = nil) async throws {
        let data = try JSONSerialization.data(withJSONObject: message, options: [])
        let wsTask = task ?? self.task
        guard let wsTask else { throw GatewayClientError.invalidResponse }
        try await wsTask.send(.data(data))
    }

    private func waitForResponse(id: String) async throws -> [String: Any] {
        while true {
            let message = try await receiveMessage()
            guard let type = message["type"] as? String else {
                continue
            }
            if type == "error" {
                let payload = message["payload"] as? String ?? "Gateway error"
                throw GatewayClientError.authenticationFailed(payload)
            }
            if type == "res", let respId = message["id"] as? String, respId == id {
                return message
            }
        }
    }

    private func receiveMessage() async throws -> [String: Any] {
        guard let task else { throw GatewayClientError.invalidResponse }
        let message = try await task.receive()
        switch message {
        case .data(let data):
            return try parseMessageData(data)
        case .string(let text):
            guard let data = text.data(using: .utf8) else {
                throw GatewayClientError.invalidMessage
            }
            return try parseMessageData(data)
        @unknown default:
            throw GatewayClientError.invalidMessage
        }
    }

    private func parseMessageData(_ data: Data) throws -> [String: Any] {
        let json = try JSONSerialization.jsonObject(with: data, options: [])
        guard let message = json as? [String: Any] else {
            throw GatewayClientError.invalidMessage
        }
        return message
    }
}

final class GatewayService {
    private let settings: GatewaySettings
    private let session = URLSession(configuration: .default)

    init(settings: GatewaySettings) {
        self.settings = settings
    }

    func sendTranscript(_ text: String) async throws {
        let trimmed = text.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else { return }
        guard let url = settings.resolvedURL else {
            throw GatewayClientError.missingURL
        }

        let client = GatewayClient(url: url, token: settings.resolvedToken, password: settings.resolvedPassword)
        defer { client.disconnect() }
        try await withTimeout(seconds: 5) {
            try await client.connect()
        }
        try await withTimeout(seconds: 3) {
            try await client.sendAgentRequest(
                content: trimmed,
                agentId: self.settings.resolvedAgentId,
                sessionKey: self.settings.resolvedSessionKey
            )
        }
    }

    func testConnection() async throws {
        guard let url = settings.resolvedURL else {
            throw GatewayClientError.missingURL
        }
        let client = GatewayClient(url: url, token: settings.resolvedToken, password: settings.resolvedPassword)
        defer { client.disconnect() }
        try await withTimeout(seconds: 5) {
            try await client.connect()
        }
    }

    func fetchSessions(limit: Int, agentId: String?) async throws -> [GatewaySessionSummary] {
        guard let baseURL = settings.resolvedHttpBaseURL else {
            throw GatewayClientError.missingURL
        }
        guard var components = URLComponents(url: baseURL, resolvingAgainstBaseURL: false) else {
            throw GatewayClientError.invalidHttpResponse
        }
        let basePath = components.path.hasSuffix("/") ? String(components.path.dropLast()) : components.path
        components.path = basePath + "/api/sessions"
        var queryItems = [URLQueryItem(name: "limit", value: String(limit))]
        if let agentId, !agentId.isEmpty {
            queryItems.append(URLQueryItem(name: "agentId", value: agentId))
        }
        components.queryItems = queryItems
        guard let url = components.url else {
            throw GatewayClientError.invalidHttpResponse
        }

        let (data, response) = try await session.data(from: url)
        guard let http = response as? HTTPURLResponse else {
            throw GatewayClientError.invalidHttpResponse
        }
        guard (200..<300).contains(http.statusCode) else {
            throw GatewayClientError.authenticationFailed("Gateway returned HTTP \(http.statusCode)")
        }
        return try JSONDecoder().decode([GatewaySessionSummary].self, from: data)
    }

    private func withTimeout<T>(seconds: Double, operation: @escaping () async throws -> T) async throws -> T {
        try await withThrowingTaskGroup(of: T.self) { group in
            group.addTask {
                try await operation()
            }
            group.addTask {
                try await Task.sleep(nanoseconds: UInt64(seconds * 1_000_000_000))
                throw GatewayClientError.timeout
            }
            let result = try await group.next()
            group.cancelAll()
            guard let value = result else {
                throw GatewayClientError.timeout
            }
            return value
        }
    }
}

struct GatewaySessionSummary: Identifiable, Decodable {
    let id: String
    let name: String?
    let agentId: String
    let createdAt: Double?
    let updatedAt: Double?
    let messageCount: Int?
    let lastMessagePreview: String?

    var displayName: String {
        let trimmed = name?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
        return trimmed.isEmpty ? id : trimmed
    }

    var updatedDate: Date? {
        guard let updatedAt else { return nil }
        return Date(timeIntervalSince1970: updatedAt / 1000)
    }
}
