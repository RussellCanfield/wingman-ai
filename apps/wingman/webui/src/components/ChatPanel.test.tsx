import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ChatPanel, computeComposerTextareaLayout } from "./ChatPanel";

const baseProps: React.ComponentProps<typeof ChatPanel> = {
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
	connected: true,
	loading: false,
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
	onOpenCommandDeck: () => {},
};

describe("ChatPanel prompt composer", () => {
	it("removes quick prompts and renders a single-bar composer with icon controls", () => {
		const html = renderToStaticMarkup(
			React.createElement(ChatPanel, baseProps),
		);

		expect(html).toContain('id="prompt-textarea"');
		expect(html).toContain(
			"rounded-2xl border border-white/10 bg-slate-950/70 p-2",
		);
		expect(html).toContain("flex items-center justify-between gap-2 px-1 pb-2");
		expect(html).toContain(
			"flex items-center gap-2 rounded-xl border border-white/10 bg-slate-900/55 px-2",
		);
		expect(html).toContain('aria-label="Send prompt"');
		expect(html).toContain('aria-label="Add files"');
		expect(html).toContain('aria-label="Record audio"');
		expect(html).not.toContain(">Prompt<");
		expect(html).not.toContain("quick prompt below");
		expect(html).not.toContain("Summarize the latest updates in this thread.");
		expect(html).not.toContain("Draft a plan of attack for the next task.");
		expect(html).not.toContain("List open questions we need to resolve.");
	});

	it("shows stop inline when streaming", () => {
		const html = renderToStaticMarkup(
			React.createElement(ChatPanel, {
				...baseProps,
				isStreaming: true,
			}),
		);

		expect(html).toContain(
			"rounded-2xl border border-white/10 bg-slate-950/70 p-2",
		);
		expect(html).toContain('aria-label="Stop response"');
		expect(html).not.toContain('aria-label="Send prompt"');
	});

	it("renders syntax-highlighted fenced code in chat messages", () => {
		const html = renderToStaticMarkup(
			React.createElement(ChatPanel, {
				...baseProps,
				activeThread: {
					...baseProps.activeThread,
					messages: [
						{
							id: "assistant-1",
							role: "assistant",
							content: "```ts\nconst value = 42;\n```",
							createdAt: 1,
						},
					],
				},
			}),
		);

		expect(html).toContain("language-ts");
		expect(html).toContain("hljs");
		expect(html).toContain('aria-label="Copy code block"');
		expect(html).toContain(">Copy<");
	});
});

describe("computeComposerTextareaLayout", () => {
	it("grows with content until max line height", () => {
		const result = computeComposerTextareaLayout({
			scrollHeight: 92,
			lineHeight: 24,
			paddingTop: 10,
			paddingBottom: 10,
			maxLines: 4,
		});

		expect(result.heightPx).toBe(92);
		expect(result.overflowY).toBe("hidden");
	});

	it("caps height and enables scrolling after max lines", () => {
		const result = computeComposerTextareaLayout({
			scrollHeight: 180,
			lineHeight: 24,
			paddingTop: 10,
			paddingBottom: 10,
			maxLines: 4,
		});

		expect(result.heightPx).toBe(116);
		expect(result.overflowY).toBe("auto");
	});
});
