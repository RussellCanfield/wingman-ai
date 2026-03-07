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
	isContextSummarizing: false,
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
	it("keeps the chat route scrollable while allowing content to shrink", () => {
		const html = renderToStaticMarkup(
			React.createElement(ChatPage, {
				...baseProps,
			}),
		);

		expect(html).toContain(
			"grid h-full min-h-0 min-w-0 flex-1 grid-rows-[auto_minmax(0,1fr)] gap-4 overflow-hidden",
		);
		expect(html).toContain('data-testid="chat-side-panel"');
		expect(html).toContain(
			'class="panel-card animate-rise shrink-0 overflow-hidden px-4 py-2 group"',
		);
		expect(html).toContain("max-h-[28vh] gap-3 overflow-y-auto pr-1");
		expect(html).toContain('<div class="min-h-0 overflow-hidden">');
	});

	it("renders the details drawer above chat and keeps it compact by default", () => {
		const html = renderToStaticMarkup(
			React.createElement(ChatPage, {
				...baseProps,
			}),
		);

		expect(html).toContain('data-testid="chat-side-panel"');
		expect(html).toContain("Thread Details");
		expect(html).toContain(">Chat<");
		expect(html.indexOf('data-testid="chat-side-panel"')).toBeLessThan(
			html.indexOf(">Chat<"),
		);
		const drawerTag = html.match(
			/<details[^>]*data-testid="chat-side-panel"[^>]*>/,
		)?.[0];
		expect(drawerTag).toBeDefined();
		expect(drawerTag).not.toContain("open");
		expect((html.match(/group-open:rotate-180/g) || []).length).toBe(1);
		expect(html).not.toContain("Session Snapshot");
		expect(html).not.toContain("Guidance");
	});

	it("renders a compact agent setup summary for the active agent", () => {
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

		expect(html).toContain("Agent Setup");
		expect(html).toContain("Main Agent");
		expect(html).toContain("codex:codex-mini-latest");
		expect(html).toContain("think, command_execute");
		expect(html).toContain("finance, fal-ai + global");
	});

	it("shows compact defaults when agent model, tools, and MCP are unset", () => {
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

		expect(html).toContain("Agent Setup");
		expect(html).toContain("Default");
		expect(html).toContain("None configured");
	});
});
