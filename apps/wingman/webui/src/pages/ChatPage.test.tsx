import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ChatPage } from "./ChatPage";

(globalThis as { React?: typeof React }).React = React;

const baseProps: React.ComponentProps<typeof ChatPage> = {
	agentId: "main",
	activeThread: {
		id: "thread-1",
		name: "Thread 1",
		agentId: "main",
		messages: [],
		createdAt: 1,
	},
	prompt: "",
	attachments: [],
	fileAccept: "*/*",
	attachmentError: "",
	isStreaming: false,
	queuedPromptCount: 0,
	connected: true,
	loadingThread: false,
	outputRoot: "/tmp/wingman-output",
	voiceAutoEnabled: false,
	voicePlayback: { status: "idle" },
	dynamicUiEnabled: true,
	onToggleVoiceAuto: () => {},
	onSpeakVoice: () => {},
	onStopVoice: () => {},
	onPromptChange: () => {},
	onSendPrompt: () => {},
	onStopPrompt: () => {},
	onAddAttachments: () => {},
	onRemoveAttachment: () => {},
	onClearAttachments: () => {},
	onClearChat: () => {},
	onDeleteThread: () => {},
	onOpenCommandDeck: () => {},
	onSetWorkdir: async () => true,
};

describe("ChatPage agent details panel", () => {
	it("renders model, tools, and MCP server details for the active agent", () => {
		const html = renderToStaticMarkup(
			React.createElement(ChatPage, {
				...baseProps,
				activeAgent: {
					id: "main",
					displayName: "Main Agent",
					model: "codex:codex-mini-latest",
					tools: ["think", "command_execute"],
					mcpServers: ["finance", "fal-ai"],
					mcpUseGlobal: true,
				},
			}),
		);

		expect(html).toContain("Agent Details");
		expect(html).toContain("Main Agent");
		expect(html).toContain("codex:codex-mini-latest");
		expect(html).toContain("think");
		expect(html).toContain("command_execute");
		expect(html).toContain("finance");
		expect(html).toContain("fal-ai");
		expect(html).toContain("Global enabled");
	});

	it("shows default values when agent model, tools, and MCP are unset", () => {
		const html = renderToStaticMarkup(
			React.createElement(ChatPage, {
				...baseProps,
				activeAgent: {
					id: "main",
					displayName: "Main Agent",
					tools: [],
				},
			}),
		);

		expect(html).toContain("Agent Details");
		expect(html).toContain("Default");
		expect(html).toContain("No custom tools configured.");
		expect(html).toContain("No MCP servers configured.");
		expect(html).not.toContain("Global enabled");
	});
});
