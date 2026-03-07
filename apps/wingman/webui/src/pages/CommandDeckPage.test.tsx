import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { CommandDeckPage } from "./CommandDeckPage";

(globalThis as { React?: typeof React }).React = React;

const baseProps: React.ComponentProps<typeof CommandDeckPage> = {
	agentId: "main",
	activeThreadName: "Thread 1",
	wsUrl: "ws://127.0.0.1:18789/ws",
	token: "",
	password: "",
	connecting: false,
	connected: true,
	statusLabel: "Connected",
	health: {
		status: "healthy",
		stats: { uptime: 120_000 },
	},
	stats: {
		nodes: { totalNodes: 3 },
		groups: { totalGroups: 2 },
	},
	authHint: "Auth is not required for this gateway.",
	autoConnect: true,
	autoConnectStatus: "",
	onAutoConnectChange: () => {},
	deviceId: "device-123",
	eventLog: [],
	providers: [],
	providersLoading: false,
	providersUpdatedAt: "2026-03-07T00:00:00.000Z",
	credentialsPath: "/tmp/credentials.json",
	voiceConfig: {
		provider: "web_speech",
		defaultPolicy: "off",
		webSpeech: {},
		elevenlabs: {},
	},
	onWsUrlChange: () => {},
	onTokenChange: () => {},
	onPasswordChange: () => {},
	onConnect: () => {},
	onDisconnect: () => {},
	onRefresh: () => {},
	onResetDevice: () => {},
	onRefreshProviders: () => {},
	onSaveProviderToken: async () => true,
	onClearProviderToken: async () => true,
	onSaveVoiceConfig: async () => true,
};

describe("CommandDeckPage", () => {
	it("renders the gateway runtime summary above the command deck", () => {
		const html = renderToStaticMarkup(
			React.createElement(CommandDeckPage, baseProps),
		);

		expect(html).toContain("Gateway Runtime");
		expect(html).toContain("Status Overview");
		expect(html).toContain("Connected");
		expect(html).toContain("healthy");
		expect(html).toContain(">3<");
		expect(html).toContain(">2<");
		expect(html).toContain("agent: main");
		expect(html).toContain("thread: Thread 1");
		expect(html.indexOf("Status Overview")).toBeLessThan(
			html.indexOf("Command Deck"),
		);
	});
});
