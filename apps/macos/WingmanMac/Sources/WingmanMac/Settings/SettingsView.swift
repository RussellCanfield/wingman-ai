import SwiftUI

struct SettingsView: View {
    @ObservedObject var recordSettings: HotkeySettings
    @ObservedObject var overlaySettings: HotkeySettings
    @ObservedObject var gatewaySettings: GatewaySettings
    let onTestGateway: (() -> Void)?
    let onLoadSessions: (() -> Void)?
    let onSelectSession: ((GatewaySessionSummary) -> Void)?
    let statusMessage: String?
    let statusIsError: Bool
    let sessions: [GatewaySessionSummary]
    let sessionsLoading: Bool
    let sessionsStatusMessage: String?
    let sessionsStatusIsError: Bool

    var body: some View {
        ZStack {
            LinearGradient(
                colors: [
                    Color.black.opacity(0.9),
                    Color.blue.opacity(0.35),
                    Color.black.opacity(0.85),
                ],
                startPoint: .topLeading,
                endPoint: .bottomTrailing
            )
            .ignoresSafeArea()

            ScrollView {
                VStack(alignment: .leading, spacing: 20) {
                    header

                    SettingsCard(
                        title: "Hotkey",
                        subtitle: "Choose how Wingman AI listens."
                    ) {
                        VStack(alignment: .leading, spacing: 12) {
                            VStack(alignment: .leading, spacing: 6) {
                                Text("Record toggle")
                                    .font(.caption)
                                    .foregroundStyle(.secondary)
                                Picker("Record toggle", selection: $recordSettings.option) {
                                    ForEach(HotkeyOption.allCases) { option in
                                        Text(option.displayName).tag(option)
                                    }
                                }
                                .pickerStyle(.radioGroup)
                            }

                            Divider()

                            VStack(alignment: .leading, spacing: 6) {
                                Text("Show overlay")
                                    .font(.caption)
                                    .foregroundStyle(.secondary)
                                Picker("Show overlay", selection: $overlaySettings.option) {
                                    ForEach(HotkeyOption.allCases) { option in
                                        Text(option.displayName).tag(option)
                                    }
                                }
                                .pickerStyle(.radioGroup)
                            }
                        }

                        Text("Defaults: Record uses Caps Lock. Overlay uses Double-press Shift. Double-press options only trigger on quick successive presses.")
                            .font(.caption)
                            .foregroundStyle(.secondary)
                    }

                    SettingsCard(
                        title: "Gateway",
                        subtitle: "Send transcripts to your Wingman Gateway."
                    ) {
                        fieldRow(title: "Gateway URL", text: $gatewaySettings.url)
                        fieldRow(title: "Gateway UI URL (optional)", text: $gatewaySettings.uiURL)
                        fieldRow(title: "Gateway Token (optional)", text: $gatewaySettings.token)
                        fieldRow(title: "Gateway Password (optional)", text: $gatewaySettings.password)
                        fieldRow(title: "Target Agent ID (optional)", text: $gatewaySettings.agentId)
                        fieldRow(title: "Target Session Key (optional)", text: $gatewaySettings.sessionKey)

                        VStack(alignment: .leading, spacing: 8) {
                            HStack(spacing: 12) {
                                Button("Test Connection") {
                                    onTestGateway?()
                                }
                                .buttonStyle(.borderedProminent)

                                if let statusMessage {
                                    Text(statusMessage)
                                        .font(.caption)
                                        .foregroundStyle(statusIsError ? .red : .secondary)
                                }
                            }

                            HStack(spacing: 12) {
                                Button(sessionsLoading ? "Loading…" : "Load Sessions") {
                                    onLoadSessions?()
                                }
                                .buttonStyle(.bordered)
                                .disabled(sessionsLoading)

                                if let sessionsStatusMessage {
                                    Text(sessionsStatusMessage)
                                        .font(.caption)
                                        .foregroundStyle(sessionsStatusIsError ? .red : .secondary)
                                }
                            }
                        }

                        Text("Default: ws://127.0.0.1:18789/ws")
                            .font(.caption)
                            .foregroundStyle(.secondary)
                        Text("Leave Gateway UI URL blank to derive it from the Gateway URL.")
                            .font(.caption)
                            .foregroundStyle(.secondary)
                        Text("Leave Agent ID and Session Key blank to start a new conversation with the default agent.")
                            .font(.caption)
                            .foregroundStyle(.secondary)

                        if sessions.isEmpty {
                            Text("No sessions loaded yet.")
                                .font(.caption)
                                .foregroundStyle(.secondary)
                        } else {
                            VStack(alignment: .leading, spacing: 10) {
                                Text("Recent sessions")
                                    .font(.caption)
                                    .foregroundStyle(.secondary)

                                ForEach(sessions.prefix(6)) { session in
                                    SessionRow(session: session) {
                                        onSelectSession?(session)
                                    }
                                }
                            }
                        }
                    }
                }
                .padding(24)
            }
        }
        .frame(minWidth: 680, minHeight: 460)
    }

    private var header: some View {
        VStack(alignment: .leading, spacing: 6) {
            Text("Wingman AI Settings")
                .font(.system(size: 24, weight: .semibold))
                .foregroundStyle(.white)
            Text("Configure hotkeys and gateway routing for the menu bar companion.")
                .font(.subheadline)
                .foregroundStyle(.white.opacity(0.7))
        }
    }

    private func fieldRow(title: String, text: Binding<String>) -> some View {
        VStack(alignment: .leading, spacing: 6) {
            Text(title)
                .font(.caption)
                .foregroundStyle(.secondary)
            TextField("", text: text)
                .textFieldStyle(.roundedBorder)
        }
    }
}

private struct SettingsCard<Content: View>: View {
    let title: String
    let subtitle: String
    @ViewBuilder let content: Content

    var body: some View {
        VStack(alignment: .leading, spacing: 14) {
            VStack(alignment: .leading, spacing: 4) {
                Text(title)
                    .font(.headline)
                    .foregroundStyle(.white)
                Text(subtitle)
                    .font(.caption)
                    .foregroundStyle(.white.opacity(0.7))
            }
            content
        }
        .padding(18)
        .background(
            RoundedRectangle(cornerRadius: 18, style: .continuous)
                .fill(.ultraThinMaterial)
        )
        .overlay(
            RoundedRectangle(cornerRadius: 18, style: .continuous)
                .stroke(Color.white.opacity(0.15), lineWidth: 1)
        )
    }
}

private struct SessionRow: View {
    let session: GatewaySessionSummary
    let onSelect: () -> Void

    var body: some View {
        HStack(alignment: .top, spacing: 12) {
            VStack(alignment: .leading, spacing: 4) {
                Text(session.displayName)
                    .font(.subheadline)
                    .foregroundStyle(.white)
                Text("Agent: \(session.agentId)")
                    .font(.caption)
                    .foregroundStyle(.white.opacity(0.7))
                if let updated = session.updatedDate {
                    Text("Updated \(updated.formatted(date: .abbreviated, time: .shortened))")
                        .font(.caption2)
                        .foregroundStyle(.white.opacity(0.6))
                }
            }
            Spacer()
            Button("Use") {
                onSelect()
            }
            .buttonStyle(.bordered)
        }
        .padding(12)
        .background(
            RoundedRectangle(cornerRadius: 12, style: .continuous)
                .fill(Color.white.opacity(0.08))
        )
    }
}
