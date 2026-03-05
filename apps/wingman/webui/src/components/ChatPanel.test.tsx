import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import {
	ChatPanel,
	computeComposerTextareaLayout,
	shouldRefocusComposer,
} from "./ChatPanel";

(globalThis as { React?: typeof React }).React = React;

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
	queuedPromptCount: 0,
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
	it("uses flexible panel sizing without hardcoded min-height overflow", () => {
		const html = renderToStaticMarkup(
			React.createElement(ChatPanel, baseProps),
		);

		expect(html).toContain("panel-card animate-rise flex h-full min-h-0");
		expect(html).not.toContain("min-h-[1200px]");
	});

	it("removes quick prompts and renders a single-bar composer with icon controls", () => {
		const html = renderToStaticMarkup(
			React.createElement(ChatPanel, baseProps),
		);

		expect(html).toContain('id="prompt-textarea"');
		expect(html).toContain(
			"border border-white/10 bg-slate-950/70 p-2 shadow-[0_12px_26px_rgba(3,9,28,0.35)] rounded-2xl",
		);
		expect(html).toContain(
			"rounded-xl border border-white/10 bg-slate-900/55 px-2",
		);
		expect(html).toContain(
			"mt-2 flex items-center justify-between gap-2 px-1",
		);
		expect(html).toContain(
			"flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border transition",
		);
		expect(html).toContain('aria-label="Send prompt"');
		expect(html).toContain('aria-label="Add files"');
		expect(html).toContain('aria-label="Record audio"');
		expect(html).not.toContain(">Prompt<");
		expect(html).not.toContain("Enter to send, Shift+Enter for newline");
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
			"border border-white/10 bg-slate-950/70 p-2 shadow-[0_12px_26px_rgba(3,9,28,0.35)] rounded-2xl",
		);
		expect(html).toContain('aria-label="Stop response"');
		expect(html).not.toContain('data-testid="streaming-indicator"');
		expect(html).not.toContain('aria-label="Send prompt"');
	});

	it("does not render floating streaming indicator while stream is active", () => {
		const html = renderToStaticMarkup(
			React.createElement(ChatPanel, {
				...baseProps,
				isStreaming: true,
			}),
		);

		expect(html).not.toContain('data-testid="streaming-indicator"');
	});

	it("keeps send action available while streaming when draft text exists", () => {
		const html = renderToStaticMarkup(
			React.createElement(ChatPanel, {
				...baseProps,
				isStreaming: true,
				prompt: "follow-up",
			}),
		);

		expect(html).toContain('aria-label="Send prompt"');
		expect(html).not.toContain('aria-label="Stop response"');
		expect(html).not.toContain("Streaming response...");
	});

	it("shows summarization status while context compression is running", () => {
		const html = renderToStaticMarkup(
			React.createElement(ChatPanel, {
				...baseProps,
				isStreaming: true,
				isContextSummarizing: true,
			}),
		);

		expect(html).toContain("Summarizing conversation...");
		expect(html).not.toContain(
			"Streaming response... Enter to queue follow-up",
		);
	});

	it("renders the latest todo progress panel as a collapsed drawer above the composer", () => {
		const html = renderToStaticMarkup(
			React.createElement(ChatPanel, {
				...baseProps,
				activeThread: {
					...(baseProps.activeThread as NonNullable<
						typeof baseProps.activeThread
					>),
					messages: [
						{
							id: "assistant-1",
							role: "assistant",
							content: "",
							createdAt: 1,
							toolEvents: [
								{
									id: "todo-1",
									name: "write_todos",
									status: "completed",
									args: {
										todos: [
											{
												content: "Inspect the todo payload",
												status: "completed",
											},
											{
												content: "Render task progress",
												status: "in_progress",
											},
										],
									},
									timestamp: 1,
								},
							],
						},
					],
				},
			}),
		);

		expect(html).toContain('data-testid="todo-progress-panel"');
		expect(html).toContain("Task progress");
		expect(html).toContain(">1/2<");
		expect(html).toContain('aria-expanded="false"');
		expect(html).toContain(">Show<");
		expect(html).toContain("mx-3 rounded-t-2xl rounded-b-none border-b-0 sm:mx-4");
		expect(html).toContain("-mt-px rounded-b-2xl rounded-t-xl");
		expect(html.indexOf('data-testid="todo-progress-panel"')).toBeLessThan(
			html.indexOf('aria-label="Add files"'),
		);
	});

	it("keeps voice toggle visible while streaming", () => {
		const html = renderToStaticMarkup(
			React.createElement(ChatPanel, {
				...baseProps,
				isStreaming: true,
				voiceAutoEnabled: true,
			}),
		);

		expect(html).toContain(">Voice: Auto<");
	});

	it("shows in-message streaming dots while the active assistant stream is running", () => {
		const html = renderToStaticMarkup(
			React.createElement(ChatPanel, {
				...baseProps,
				isStreaming: true,
				activeThread: {
					...(baseProps.activeThread as NonNullable<
						typeof baseProps.activeThread
					>),
					messages: [
						{
							id: "assistant-streaming",
							role: "assistant",
							content: "Partial response text",
							createdAt: 1,
							toolEvents: [
								{
									id: "tool-streaming-1",
									name: "edit_file",
									status: "running",
									timestamp: 1,
								},
							],
						},
					],
				},
			}),
		);

		expect(html).toContain('data-testid="message-streaming-indicator"');
		expect(html).toContain("Partial response text");
		expect(html).toContain("edit_file");
	});

	it("hides in-message streaming dots when stream is idle", () => {
		const html = renderToStaticMarkup(
			React.createElement(ChatPanel, {
				...baseProps,
				isStreaming: false,
				activeThread: {
					...(baseProps.activeThread as NonNullable<
						typeof baseProps.activeThread
					>),
					messages: [
						{
							id: "assistant-idle",
							role: "assistant",
							content: "Finished response",
							createdAt: 1,
						},
					],
				},
			}),
		);

		expect(html).not.toContain('data-testid="message-streaming-indicator"');
	});

	it("renders image preview modal above side panels", () => {
		const html = renderToStaticMarkup(
			React.createElement(ChatPanel, {
				...baseProps,
				initialPreviewAttachment: {
					id: "preview-1",
					kind: "image",
					dataUrl: "data:image/png;base64,abc",
					name: "preview.png",
				},
			}),
		);

		expect(html).toContain("fixed inset-0 z-[120] grid place-items-center");
		expect(html).toContain("preview.png");
	});

	it("renders syntax-highlighted fenced code in chat messages", () => {
		const html = renderToStaticMarkup(
			React.createElement(ChatPanel, {
				...baseProps,
				activeThread: {
					...(baseProps.activeThread as NonNullable<
						typeof baseProps.activeThread
					>),
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

	it("renders an audio player for assistant markdown audio links", () => {
		const audioUrl = "https://cdn.example.com/sfx/whoosh.wav";
		const html = renderToStaticMarkup(
			React.createElement(ChatPanel, {
				...baseProps,
				activeThread: {
					...(baseProps.activeThread as NonNullable<
						typeof baseProps.activeThread
					>),
					messages: [
						{
							id: "assistant-audio-link",
							role: "assistant",
							content: `[Preview audio](${audioUrl})`,
							createdAt: 1,
						},
					],
				},
			}),
		);

		expect(html).toContain("<audio");
		expect(html).toContain(`src="${audioUrl}"`);
		expect(html).toContain(">Open audio in new tab<");
		expect(html).toContain("min-w-0 max-w-full");
		expect(html).not.toContain("min-w-[220px]");
	});

	it("keeps user markdown audio links as normal anchors", () => {
		const audioUrl = "https://cdn.example.com/sfx/whoosh.wav";
		const html = renderToStaticMarkup(
			React.createElement(ChatPanel, {
				...baseProps,
				activeThread: {
					...(baseProps.activeThread as NonNullable<
						typeof baseProps.activeThread
					>),
					messages: [
						{
							id: "user-audio-link",
							role: "user",
							content: `[Preview audio](${audioUrl})`,
							createdAt: 1,
						},
					],
				},
			}),
		);

		expect(html).not.toContain("<audio");
		expect(html).toContain(`href="${audioUrl}"`);
	});

	it("renders an audio player for assistant inline code file paths", () => {
		const path = "./generated/audio/test-sfx.wav";
		const html = renderToStaticMarkup(
			React.createElement(ChatPanel, {
				...baseProps,
				activeThread: {
					...(baseProps.activeThread as NonNullable<
						typeof baseProps.activeThread
					>),
					messages: [
						{
							id: "assistant-audio-path",
							role: "assistant",
							content: `File: \`${path}\``,
							createdAt: 1,
						},
					],
				},
			}),
		);

		expect(html).toContain("<audio");
		expect(html).toContain(
			`src="/api/fs/file?path=${encodeURIComponent(path)}"`,
		);
		expect(html).toContain("test-sfx.wav");
		expect(html).toContain("min-w-0 max-w-full");
		expect(html).not.toContain("min-w-[220px]");
	});

	it("uses fluid sizing for audio attachments to prevent mobile overflow", () => {
		const html = renderToStaticMarkup(
			React.createElement(ChatPanel, {
				...baseProps,
				activeThread: {
					...(baseProps.activeThread as NonNullable<
						typeof baseProps.activeThread
					>),
					messages: [
						{
							id: "assistant-audio-attachment",
							role: "assistant",
							content: "Attached audio",
							createdAt: 1,
							attachments: [
								{
									id: "audio-1",
									kind: "audio",
									dataUrl: "data:audio/wav;base64,abc123",
									name: "impact.wav",
									mimeType: "audio/wav",
								},
							],
						},
					],
				},
			}),
		);

		expect(html).toContain("block w-full min-w-0 max-w-[360px]");
		expect(html).not.toContain("min-w-[200px]");
		expect(html).not.toContain("sm:min-w-[240px]");
	});

	it("resolves assistant inline audio paths against thread workdir", () => {
		const workdir = "/Users/test/.wingman/outputs/game-dev";
		const path = "./generated/audio/test-sfx.wav";
		const expected = `${workdir}/generated/audio/test-sfx.wav`;
		const html = renderToStaticMarkup(
			React.createElement(ChatPanel, {
				...baseProps,
				activeThread: {
					...(baseProps.activeThread as NonNullable<
						typeof baseProps.activeThread
					>),
					workdir,
					messages: [
						{
							id: "assistant-audio-path-workdir",
							role: "assistant",
							content: `File: \`${path}\``,
							createdAt: 1,
						},
					],
				},
			}),
		);

		expect(html).toContain(
			`src="/api/fs/file?path=${encodeURIComponent(expected)}"`,
		);
	});

	it("resolves assistant inline audio paths against default output dir when workdir is unset", () => {
		const defaultOutputDir = "/Users/test/.wingman/outputs/game-dev";
		const path = "./generated/audio/test-sfx.wav";
		const expected = `${defaultOutputDir}/generated/audio/test-sfx.wav`;
		const html = renderToStaticMarkup(
			React.createElement(ChatPanel, {
				...baseProps,
				defaultOutputDir,
				activeThread: {
					...(baseProps.activeThread as NonNullable<
						typeof baseProps.activeThread
					>),
					workdir: null,
					messages: [
						{
							id: "assistant-audio-path-default-output",
							role: "assistant",
							content: `File: \`${path}\``,
							createdAt: 1,
						},
					],
				},
			}),
		);

		expect(html).toContain(
			`src="/api/fs/file?path=${encodeURIComponent(expected)}"`,
		);
	});

	it("does not render audio previews for user inline code file paths", () => {
		const path = "./generated/audio/test-sfx.wav";
		const html = renderToStaticMarkup(
			React.createElement(ChatPanel, {
				...baseProps,
				activeThread: {
					...(baseProps.activeThread as NonNullable<
						typeof baseProps.activeThread
					>),
					messages: [
						{
							id: "user-audio-path",
							role: "user",
							content: `File: \`${path}\``,
							createdAt: 1,
						},
					],
				},
			}),
		);

		expect(html).not.toContain("<audio");
	});

	it("applies compact bottom spacing to markdown unordered lists", () => {
		const html = renderToStaticMarkup(
			React.createElement(ChatPanel, {
				...baseProps,
				activeThread: {
					...(baseProps.activeThread as NonNullable<
						typeof baseProps.activeThread
					>),
					messages: [
						{
							id: "assistant-list",
							role: "assistant",
							content: "- First\n- Second",
							createdAt: 1,
						},
					],
				},
			}),
		);

		expect(html).toContain('<ul class="ml-5 list-disc space-y-1 mb-1">');
	});

	it("normalizes return symbols so streamed markdown lists render correctly", () => {
		const html = renderToStaticMarkup(
			React.createElement(ChatPanel, {
				...baseProps,
				activeThread: {
					...(baseProps.activeThread as NonNullable<
						typeof baseProps.activeThread
					>),
					messages: [
						{
							id: "assistant-list-return-symbol",
							role: "assistant",
							content: "- Item one↵- Item two↵- Item three",
							createdAt: 1,
						},
					],
				},
			}),
		);

		expect(html).toContain('<ul class="ml-5 list-disc space-y-1 mb-1">');
		expect(html).toContain("<li>Item one</li>");
		expect(html).toContain("<li>Item two</li>");
		expect(html).toContain("<li>Item three</li>");
	});

	it("normalizes escaped newline sequences in assistant output", () => {
		const html = renderToStaticMarkup(
			React.createElement(ChatPanel, {
				...baseProps,
				activeThread: {
					...(baseProps.activeThread as NonNullable<
						typeof baseProps.activeThread
					>),
					messages: [
						{
							id: "assistant-escaped-newline",
							role: "assistant",
							content: "Line one\\n\\n- Item A\\n- Item B",
							createdAt: 1,
						},
					],
				},
			}),
		);

		expect(html).not.toContain("\\n");
		expect(html).toContain("<li>Item A</li>");
		expect(html).toContain("<li>Item B</li>");
	});

	it("keeps existing messages visible while loading", () => {
		const html = renderToStaticMarkup(
			React.createElement(ChatPanel, {
				...baseProps,
				loading: true,
				activeThread: {
					...(baseProps.activeThread as NonNullable<
						typeof baseProps.activeThread
					>),
					messages: [
						{
							id: "user-1",
							role: "user",
							content: "Hello",
							createdAt: 1,
						},
					],
				},
			}),
		);

		expect(html).toContain("Hello");
		expect(html).not.toContain("Loading messages...");
	});

	it("does not render typing dots for assistant messages with tool activity", () => {
		const html = renderToStaticMarkup(
			React.createElement(ChatPanel, {
				...baseProps,
				activeThread: {
					...(baseProps.activeThread as NonNullable<
						typeof baseProps.activeThread
					>),
					messages: [
						{
							id: "assistant-tools",
							role: "assistant",
							content: "",
							createdAt: 1,
							toolEvents: [
								{
									id: "tool-1",
									name: "edit_file",
									status: "completed",
									timestamp: 1,
								},
							],
						},
					],
				},
			}),
		);

		expect(html).toContain("edit_file");
		expect(html).not.toContain("Execution Trace");
		expect(html).not.toContain("animate-pulse rounded-full bg-sky-400");
	});

	it("renders assistant timeline blocks in stream order with tools interleaved", () => {
		const html = renderToStaticMarkup(
			React.createElement(ChatPanel, {
				...baseProps,
				activeThread: {
					...(baseProps.activeThread as NonNullable<
						typeof baseProps.activeThread
					>),
					messages: [
						{
							id: "assistant-ordered",
							role: "assistant",
							content: "Before tool\\nAfter tool",
							createdAt: 1,
							toolEvents: [
								{
									id: "tool-ordered-1",
									name: "edit_file",
									status: "completed",
									timestamp: 2,
								},
							],
							activityTimeline: [
								{
									id: "timeline-text-1",
									kind: "text",
									order: 1,
									text: "Before tool",
								},
								{
									id: "timeline-tool-1",
									kind: "tool",
									order: 2,
									toolEventId: "tool-ordered-1",
								},
								{
									id: "timeline-text-2",
									kind: "text",
									order: 3,
									text: "After tool",
								},
							],
						},
					],
				},
			}),
		);

		const beforeIndex = html.indexOf("Before tool");
		const toolIndex = html.indexOf("edit_file");
		const afterIndex = html.indexOf("After tool");
		expect(beforeIndex).toBeGreaterThan(-1);
		expect(toolIndex).toBeGreaterThan(-1);
		expect(afterIndex).toBeGreaterThan(-1);
		expect(beforeIndex).toBeLessThan(toolIndex);
		expect(toolIndex).toBeLessThan(afterIndex);
		expect(html.match(/edit_file/g)?.length ?? 0).toBe(1);
	});

	it("renders unsorted assistant timeline blocks in order", () => {
		const html = renderToStaticMarkup(
			React.createElement(ChatPanel, {
				...baseProps,
				activeThread: {
					...(baseProps.activeThread as NonNullable<
						typeof baseProps.activeThread
					>),
					messages: [
						{
							id: "assistant-unsorted",
							role: "assistant",
							content: "Before tool\\nAfter tool",
							createdAt: 1,
							toolEvents: [
								{
									id: "tool-unsorted-1",
									name: "edit_file",
									status: "completed",
									timestamp: 2,
								},
							],
							activityTimeline: [
								{
									id: "timeline-text-2",
									kind: "text",
									order: 3,
									text: "After tool",
								},
								{
									id: "timeline-tool-1",
									kind: "tool",
									order: 2,
									toolEventId: "tool-unsorted-1",
								},
								{
									id: "timeline-text-1",
									kind: "text",
									order: 1,
									text: "Before tool",
								},
							],
						},
					],
				},
			}),
		);

		const beforeIndex = html.indexOf("Before tool");
		const toolIndex = html.indexOf("edit_file");
		const afterIndex = html.indexOf("After tool");
		expect(beforeIndex).toBeGreaterThan(-1);
		expect(toolIndex).toBeGreaterThan(-1);
		expect(afterIndex).toBeGreaterThan(-1);
		expect(beforeIndex).toBeLessThan(toolIndex);
		expect(toolIndex).toBeLessThan(afterIndex);
	});

	it("does not render the Wingman role label in assistant messages", () => {
		const html = renderToStaticMarkup(
			React.createElement(ChatPanel, {
				...baseProps,
				activeThread: {
					...(baseProps.activeThread as NonNullable<
						typeof baseProps.activeThread
					>),
					messages: [
						{
							id: "assistant-plain",
							role: "assistant",
							content: "Hello from assistant",
							createdAt: 1,
						},
					],
				},
			}),
		);

		expect(html).not.toContain(">Wingman<");
		expect(html).toContain("Hello from assistant");
	});

	it("renders compact assistant voice control next to timestamp", () => {
		const html = renderToStaticMarkup(
			React.createElement(ChatPanel, {
				...baseProps,
				activeThread: {
					...(baseProps.activeThread as NonNullable<
						typeof baseProps.activeThread
					>),
					messages: [
						{
							id: "assistant-voice",
							role: "assistant",
							content: "Can be played",
							createdAt: 1,
						},
					],
				},
			}),
		);

		expect(html).toContain('aria-label="Play assistant response"');
		expect(html).toContain("inline-flex h-6 w-6 items-center justify-center");
	});

	it("shows one voice control per continuous assistant turn", () => {
		const html = renderToStaticMarkup(
			React.createElement(ChatPanel, {
				...baseProps,
				activeThread: {
					...(baseProps.activeThread as NonNullable<
						typeof baseProps.activeThread
					>),
					messages: [
						{
							id: "assistant-turn-a-1",
							role: "assistant",
							content: "First chunk in turn A",
							createdAt: 1,
						},
						{
							id: "assistant-turn-a-2",
							role: "assistant",
							content: "Second chunk in turn A",
							createdAt: 2,
						},
						{
							id: "user-break",
							role: "user",
							content: "next",
							createdAt: 3,
						},
						{
							id: "assistant-turn-b-1",
							role: "assistant",
							content: "First chunk in turn B",
							createdAt: 4,
						},
					],
				},
			}),
		);

		const voiceControlCount = (
			html.match(/aria-label="Play assistant response"/g) || []
		).length;
		expect(voiceControlCount).toBe(2);
	});

	it("uses compact spacing for consecutive assistant chunks", () => {
		const html = renderToStaticMarkup(
			React.createElement(ChatPanel, {
				...baseProps,
				activeThread: {
					...(baseProps.activeThread as NonNullable<
						typeof baseProps.activeThread
					>),
					messages: [
						{
							id: "assistant-a-1",
							role: "assistant",
							content: "First chunk",
							createdAt: 1,
						},
						{
							id: "assistant-a-2",
							role: "assistant",
							content: "Second chunk",
							createdAt: 2,
						},
					],
				},
			}),
		);

		expect(html).toContain("flex justify-start mt-0");
		expect(html).not.toContain("flex justify-start mt-1");
		expect(html).not.toContain("min-h-full space-y-4 p-3 sm:p-4");
	});

	it("shows assistant timestamp only at the start of a continuous assistant turn", () => {
		const html = renderToStaticMarkup(
			React.createElement(ChatPanel, {
				...baseProps,
				activeThread: {
					...(baseProps.activeThread as NonNullable<
						typeof baseProps.activeThread
					>),
					messages: [
						{
							id: "assistant-turn-start",
							role: "assistant",
							content: "",
							createdAt: 1_700_000_000_000,
							toolEvents: [
								{
									id: "tool-a",
									name: "read_file",
									status: "completed",
									timestamp: 1_700_000_000_010,
								},
							],
						},
						{
							id: "assistant-turn-next",
							role: "assistant",
							content: "",
							createdAt: 1_700_000_000_500,
							toolEvents: [
								{
									id: "tool-b",
									name: "command_execute",
									status: "completed",
									timestamp: 1_700_000_000_510,
								},
							],
						},
					],
				},
			}),
		);

		const timestampCount = (html.match(/class="whitespace-nowrap"/g) || [])
			.length;
		expect(timestampCount).toBe(1);
	});

	it("renders conversation-level context progress below the composer input", () => {
		const html = renderToStaticMarkup(
			React.createElement(ChatPanel, {
				...baseProps,
				summarizationConfig: {
					enabled: true,
					maxTokensBeforeSummary: 12000,
					messagesToKeep: 8,
				},
				activeThread: {
					...(baseProps.activeThread as NonNullable<
						typeof baseProps.activeThread
					>),
					messages: [
						{
							id: "assistant-context-1",
							role: "assistant",
							content: "Working...",
							createdAt: 1,
							contextUsage: {
								inputTokens: 8420,
								outputTokens: 512,
								totalTokens: 8932,
								thresholdTokens: 12000,
								percentOfThreshold: 70,
								summarized: true,
								updatedAt: 2,
							},
						},
					],
				},
			}),
		);

		expect(html).toContain('data-testid="conversation-context-meter"');
		expect(html).toContain('aria-label="Conversation context usage"');
		expect(html).toContain("Context 8,420 / 12,000 (70%)");
		expect(html).toContain("Output 512");
		expect(html).toContain("Context summarized");
		expect(html.indexOf('id="prompt-textarea"')).toBeLessThan(
			html.indexOf('data-testid="conversation-context-meter"'),
		);
	});

	it("shows summarization disabled state in context meter", () => {
		const html = renderToStaticMarkup(
			React.createElement(ChatPanel, {
				...baseProps,
				summarizationConfig: {
					enabled: false,
					maxTokensBeforeSummary: 12000,
					messagesToKeep: 8,
				},
				activeThread: {
					...(baseProps.activeThread as NonNullable<
						typeof baseProps.activeThread
					>),
					messages: [
						{
							id: "assistant-context-off",
							role: "assistant",
							content: "Working...",
							createdAt: 1,
							contextUsage: {
								inputTokens: 8420,
								outputTokens: 0,
								totalTokens: 8420,
								updatedAt: 2,
							},
						},
					],
				},
			}),
		);

		expect(html).toContain("Context 8,420");
		expect(html).toContain("Summarization off");
		expect(html).not.toContain("/ 12,000");
	});

	it("falls back to total tokens when input tokens are missing", () => {
		const html = renderToStaticMarkup(
			React.createElement(ChatPanel, {
				...baseProps,
				summarizationConfig: {
					enabled: true,
					maxTokensBeforeSummary: 12000,
					messagesToKeep: 8,
				},
				activeThread: {
					...(baseProps.activeThread as NonNullable<
						typeof baseProps.activeThread
					>),
					messages: [
						{
							id: "assistant-context-total-fallback",
							role: "assistant",
							content: "Working...",
							createdAt: 1,
							contextUsage: {
								inputTokens: 0,
								outputTokens: 611,
								totalTokens: 9453,
								updatedAt: 2,
							},
						},
					],
				},
			}),
		);

		expect(html).toContain("Context 9,453 / 12,000 (79%)");
		expect(html).toContain("Output 611");
	});

	it("prefers estimated context tokens for the meter and shows provider prompt tokens as secondary info", () => {
		const html = renderToStaticMarkup(
			React.createElement(ChatPanel, {
				...baseProps,
				summarizationConfig: {
					enabled: true,
					maxTokensBeforeSummary: 12000,
					messagesToKeep: 8,
				},
				activeThread: {
					...(baseProps.activeThread as NonNullable<
						typeof baseProps.activeThread
					>),
					messages: [
						{
							id: "assistant-context-estimated",
							role: "assistant",
							content: "Working...",
							createdAt: 1,
							contextUsage: {
								inputTokens: 17374,
								estimatedInputTokens: 8889,
								outputTokens: 149,
								totalTokens: 17523,
								updatedAt: 2,
							},
						},
					],
				},
			}),
		);

		expect(html).toContain("Context 8,889 / 12,000 (74%)");
		expect(html).toContain("Provider prompt 17,374");
		expect(html).toContain("Output 149");
	});

	it("shows a single conversation context meter using the latest assistant usage", () => {
		const html = renderToStaticMarkup(
			React.createElement(ChatPanel, {
				...baseProps,
				summarizationConfig: {
					enabled: true,
					maxTokensBeforeSummary: 12000,
					messagesToKeep: 8,
				},
				activeThread: {
					...(baseProps.activeThread as NonNullable<
						typeof baseProps.activeThread
					>),
					messages: [
						{
							id: "assistant-context-old",
							role: "assistant",
							content: "Older response",
							createdAt: 1,
							contextUsage: {
								inputTokens: 4000,
								outputTokens: 300,
								totalTokens: 4300,
								updatedAt: 2,
							},
						},
						{
							id: "assistant-context-latest",
							role: "assistant",
							content: "Latest response",
							createdAt: 3,
							contextUsage: {
								inputTokens: 9000,
								outputTokens: 500,
								totalTokens: 9500,
								updatedAt: 4,
							},
						},
					],
				},
			}),
		);

		const meterCount = (
			html.match(/data-testid="conversation-context-meter"/g) || []
		).length;
		expect(meterCount).toBe(1);
		expect(html).toContain("Context 9,000 / 12,000 (75%)");
		expect(html).not.toContain("Context 4,000 / 12,000 (33%)");
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

describe("shouldRefocusComposer", () => {
	it("returns true only when streaming transitions to idle", () => {
		expect(
			shouldRefocusComposer({
				wasStreaming: true,
				isStreaming: false,
			}),
		).toBe(true);
		expect(
			shouldRefocusComposer({
				wasStreaming: false,
				isStreaming: false,
			}),
		).toBe(false);
		expect(
			shouldRefocusComposer({
				wasStreaming: false,
				isStreaming: true,
			}),
		).toBe(false);
		expect(
			shouldRefocusComposer({
				wasStreaming: true,
				isStreaming: true,
			}),
		).toBe(false);
	});
});
