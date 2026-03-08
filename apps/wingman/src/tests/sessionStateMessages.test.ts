import { describe, expect, it } from "vitest";
import { extractMessagesFromState } from "../cli/core/sessionManager.js";

describe("extractMessagesFromState", () => {
	it("maps state messages using createdAt", () => {
		const state = {
			createdAt: "2025-01-01T00:00:00.000Z",
			values: {
				messages: [
					{ role: "user", content: "hi" },
					{ role: "assistant", content: "hello" },
				],
			},
		};

		const result = extractMessagesFromState(state);
		expect(result).not.toBeNull();
		expect(result).toHaveLength(2);
		expect(result?.[0]).toMatchObject({ role: "user", content: "hi" });
		expect(result?.[1]).toMatchObject({ role: "assistant", content: "hello" });

		const baseTime = new Date("2025-01-01T00:00:00.000Z").getTime();
		expect(result?.[0]?.createdAt).toBe(baseTime);
		expect(result?.[1]?.createdAt).toBe(baseTime + 1);
	});

	it("filters non-user messages and ui_hidden entries", () => {
		const state = {
			createdAt: 1000,
			values: {
				messages: [
					{ role: "tool", content: "skip" },
					{
						role: "assistant",
						content: "",
						additional_kwargs: { ui_hidden: true },
					},
					{ role: "assistant", content: "keep" },
				],
			},
		};

		const result = extractMessagesFromState(state);
		expect(result).not.toBeNull();
		expect(result).toHaveLength(2);
		expect(result?.[0]).toMatchObject({
			role: "assistant",
			content: "",
			toolEvents: [
				{
					name: "tool",
					status: "completed",
					output: "skip",
				},
			],
			activityTimeline: [
				{
					kind: "tool",
				},
			],
		});
		expect(result?.[1]).toMatchObject({ role: "assistant", content: "keep" });
	});

	it("extracts content from responses-style text blocks", () => {
		const state = {
			createdAt: 2000,
			values: {
				messages: [
					{
						role: "user",
						content: [{ type: "input_text", text: "Build a plan" }],
					},
					{
						role: "assistant",
						content: [{ type: "output_text", text: "Here is the plan." }],
					},
				],
			},
		};

		const result = extractMessagesFromState(state);
		expect(result).not.toBeNull();
		expect(result).toHaveLength(2);
		expect(result?.[0]).toMatchObject({
			role: "user",
			content: "Build a plan",
		});
		expect(result?.[1]).toMatchObject({
			role: "assistant",
			content: "Here is the plan.",
		});
	});

	it("promotes tool image outputs into assistant attachments", () => {
		const state = {
			createdAt: 3000,
			values: {
				messages: [
					{ role: "user", content: "Create a puppy image." },
					{
						role: "tool",
						content: JSON.stringify({
							content: [
								{ type: "text", text: "Generated image." },
								{
									type: "resource_link",
									uri: "/api/fs/file?path=%2Ftmp%2Fpuppy.png",
									mimeType: "image/png",
								},
							],
						}),
					},
				],
			},
		};

		const result = extractMessagesFromState(state);
		expect(result).not.toBeNull();
		expect(result).toHaveLength(2);
		expect(result?.[1]).toMatchObject({
			role: "assistant",
			content: "",
			attachments: [
				{
					kind: "image",
					dataUrl: "/api/fs/file?path=%2Ftmp%2Fpuppy.png",
				},
			],
			toolEvents: [
				{
					name: "tool",
					status: "completed",
				},
			],
		});
	});

	it("extracts tool attachments when MCP payload is wrapped in a text block", () => {
		const state = {
			createdAt: 4000,
			values: {
				messages: [
					{ role: "user", content: "Generate a landscape image." },
					{
						role: "tool",
						content: [
							{
								type: "text",
								text: JSON.stringify({
									content: [
										{ type: "text", text: "Image ready." },
										{
											type: "resource_link",
											uri: "/api/fs/file?path=%2Ftmp%2Flandscape.png",
											mimeType: "image/png",
										},
									],
								}),
							},
						],
					},
				],
			},
		};

		const result = extractMessagesFromState(state);
		expect(result).not.toBeNull();
		expect(result).toHaveLength(2);
		expect(result?.[1]).toMatchObject({
			role: "assistant",
			content: "",
			attachments: [
				{
					kind: "image",
					dataUrl: "/api/fs/file?path=%2Ftmp%2Flandscape.png",
				},
			],
			toolEvents: [
				{
					name: "tool",
					status: "completed",
				},
			],
		});
	});

	it("extracts tool image attachments from artifact blocks", () => {
		const state = {
			createdAt: 5000,
			values: {
				messages: [
					{ role: "user", content: "Generate another image." },
					{
						role: "tool",
						content: "Generated image.",
						artifact: [
							{
								type: "image",
								mimeType: "image/png",
								data: "abc123",
							},
						],
					},
				],
			},
		};

		const result = extractMessagesFromState(state);
		expect(result).not.toBeNull();
		expect(result).toHaveLength(2);
		expect(result?.[1]).toMatchObject({
			role: "assistant",
			content: "",
			attachments: [
				{
					kind: "image",
					dataUrl: "data:image/png;base64,abc123",
				},
			],
			toolEvents: [
				{
					name: "tool",
					status: "completed",
				},
			],
		});
	});

	it("promotes tool video resource links into assistant file attachments", () => {
		const state = {
			createdAt: 6000,
			values: {
				messages: [
					{ role: "user", content: "Record the browser session." },
					{
						role: "tool",
						content: JSON.stringify({
							content: [
								{ type: "text", text: "Saved browser recording." },
								{
									type: "resource_link",
									uri: "/api/fs/file?path=%2Ftmp%2Frecording.webm",
									mimeType: "video/webm",
									name: "recording.webm",
								},
							],
						}),
					},
				],
			},
		};

		const result = extractMessagesFromState(state);
		expect(result).not.toBeNull();
		expect(result).toHaveLength(2);
		expect(result?.[1]).toMatchObject({
			role: "assistant",
			content: "",
			attachments: [
				{
					kind: "file",
					dataUrl: "/api/fs/file?path=%2Ftmp%2Frecording.webm",
					mimeType: "video/webm",
					name: "recording.webm",
				},
			],
			toolEvents: [
				{
					name: "tool",
					status: "completed",
				},
			],
		});
	});

	it("hydrates raw persisted tool payloads into structured tool events", () => {
		const state = {
			createdAt: 7000,
			values: {
				messages: [
					{ role: "user", content: "Open the local build in a browser." },
					{
						role: "tool",
						name: "browser_session_action",
						tool_call_id: "tool-browser-1",
						content: JSON.stringify({
							ok: true,
							session_id: "session-1",
							status: "running",
							final_url: "http://127.0.0.1:4174/",
							action_results: [{ type: "wait", ms: 3000 }],
							media: [
								{
									kind: "image",
									url: "/api/fs/file?path=%2Ftmp%2Fscreenshot.png",
									mimeType: "image/png",
									name: "screenshot.png",
								},
							],
						}),
					},
				],
			},
		};

		const result = extractMessagesFromState(state);
		expect(result).not.toBeNull();
		expect(result).toHaveLength(2);
		expect(result?.[1]).toMatchObject({
			role: "assistant",
			content: "",
			toolEvents: [
				{
					id: "tool-browser-1",
					name: "browser_session_action",
					status: "completed",
					output: {
						ok: true,
						session_id: "session-1",
						status: "running",
						final_url: "http://127.0.0.1:4174/",
					},
				},
			],
			activityTimeline: [
				{
					kind: "tool",
					toolEventId: "tool-browser-1",
				},
			],
		});
	});
});
