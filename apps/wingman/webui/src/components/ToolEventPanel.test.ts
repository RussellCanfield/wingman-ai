import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import {
	extractToolAudioPreviews,
	extractToolImagePreviews,
	formatToolEventDuration,
	stringifyToolEventValue,
	summarizeToolEventValue,
	ToolEventPanel,
} from "./ToolEventPanel";

describe("ToolEventPanel helpers", () => {
	it("stringifies objects", () => {
		const result = stringifyToolEventValue({ q: "wingman", limit: 3 });

		expect(result).toContain('"q": "wingman"');
		expect(result).toContain('"limit": 3');
	});

	it("truncates long payload strings", () => {
		const result = stringifyToolEventValue("x".repeat(20), 10);

		expect(result).toBe("xxxxxxxxxx...");
	});

	it("drops leaked internal tool envelope payload text", () => {
		const result = stringifyToolEventValue(
			'assistant to=multi_tool_use.parallel commentary json {"tool_uses":[{"recipient_name":"functions.git_status","parameters":{"includeStaged":true}}]}',
		);

		expect(result).toBeNull();
	});

	it("summarizes payload text into one compact line", () => {
		const result = summarizeToolEventValue({
			query: "search docs",
			filters: ["latest", "api"],
		});

		expect(result).toBeTruthy();
		expect(result).not.toContain("\n");
		expect(result).toContain("search docs");
	});

	it("formats sub-second durations in milliseconds", () => {
		const result = formatToolEventDuration({
			id: "tool-1",
			name: "internet_search",
			status: "completed",
			startedAt: 1000,
			completedAt: 1550,
		});

		expect(result).toBe("550ms");
	});

	it("formats running durations against provided current time", () => {
		const result = formatToolEventDuration(
			{
				id: "tool-2",
				name: "web_crawler",
				status: "running",
				startedAt: 5_000,
			},
			8_250,
		);

		expect(result).toBe("3.3s");
	});

	it("returns null duration when no valid start time exists", () => {
		const result = formatToolEventDuration({
			id: "tool-3",
			name: "think",
			status: "completed",
		});

		expect(result).toBeNull();
	});

	it("renders payload blocks with wrapped constrained output", () => {
		const html = renderToStaticMarkup(
			React.createElement(ToolEventPanel, {
				variant: "inline",
				toolEvents: [
					{
						id: "tool-4",
						name: "internet_search",
						status: "completed",
						args: { query: "wingman" },
						output: `https://example.com/${"x".repeat(500)}`,
					},
				],
			}),
		);

		expect(html).toContain("group w-full min-w-0");
		expect(html).toContain("whitespace-pre-wrap");
		expect(html).toContain("overflow-x-hidden");
		expect(html).toContain("[overflow-wrap:anywhere]");
	});

	it("hides completed badge text and uses chevron detail affordance", () => {
		const html = renderToStaticMarkup(
			React.createElement(ToolEventPanel, {
				variant: "inline",
				toolEvents: [
					{
						id: "tool-4a",
						name: "read_file",
						status: "completed",
					},
				],
			}),
		);

		expect(html).not.toContain(">Completed<");
		expect(html).not.toContain("Details");
		expect(html).toContain("group-open:rotate-180");
	});

	it("centers the tool status icon vertically in the row", () => {
		const html = renderToStaticMarkup(
			React.createElement(ToolEventPanel, {
				variant: "inline",
				toolEvents: [
					{
						id: "tool-4b",
						name: "command_execute",
						status: "running",
					},
				],
			}),
		);

		expect(html).toContain("list-none items-center justify-between");
		expect(html).toContain("min-w-0 flex items-center gap-3");
		expect(html).not.toContain("mt-0.5");
	});

	it("renders actor labels when subagent metadata is present", () => {
		const html = renderToStaticMarkup(
			React.createElement(ToolEventPanel, {
				variant: "inline",
				toolEvents: [
					{
						id: "tool-actor-1",
						name: "task",
						actor: "implementor",
						status: "running",
					},
				],
			}),
		);

		expect(html).toContain("implementor");
	});

	it("renders invoked agent summary in panel variant", () => {
		const html = renderToStaticMarkup(
			React.createElement(ToolEventPanel, {
				variant: "panel",
				toolEvents: [
					{
						id: "tool-actor-2",
						name: "task",
						actor: "researcher",
						status: "running",
					},
					{
						id: "tool-actor-3",
						name: "task",
						actor: "reviewer",
						status: "completed",
					},
				],
			}),
		);

		expect(html).toContain("Invoked agents");
		expect(html).toContain("researcher active");
		expect(html).toContain("reviewer 1");
	});

	it("renders edit_file diff preview when replacement args are available", () => {
		const html = renderToStaticMarkup(
			React.createElement(ToolEventPanel, {
				variant: "inline",
				toolEvents: [
					{
						id: "tool-diff-1",
						name: "edit_file",
						status: "completed",
						args: {
							file_path: "src/file.ts",
							old_string: "const before = 1;",
							new_string: "const after = 2;",
							replace_all: false,
						},
					},
				],
			}),
		);

		expect(html).toContain("Diff preview");
		expect(html).toContain("--- src/file.ts");
		expect(html).toContain("-const before = 1;");
		expect(html).toContain("+const after = 2;");
	});

	it("renders task target badge for deepagents task calls", () => {
		const html = renderToStaticMarkup(
			React.createElement(ToolEventPanel, {
				variant: "inline",
				toolEvents: [
					{
						id: "tool-task-1",
						name: "task",
						status: "running",
						args: {
							subagent_type: "researcher",
							description: "Collect references",
						},
					},
				],
			}),
		);

		expect(html).toContain("researcher");
	});

	it("handles malformed tool events that are missing a string name", () => {
		const html = renderToStaticMarkup(
			React.createElement(ToolEventPanel, {
				variant: "inline",
				toolEvents: [
					{
						id: "tool-bad-1",
						name: undefined as unknown as string,
						status: "running",
					},
				],
			}),
		);

		expect(html).toContain("Running");
	});

	it("extracts image previews from structured tool output", () => {
		const previews = extractToolImagePreviews({
			structuredContent: {
				images: [
					{
						path: "/tmp/generated.png",
					},
					{
						url: "/api/fs/file?path=%2Ftmp%2Fgenerated-2.png",
					},
				],
			},
		});

		expect(previews).toEqual([
			{
				src: "/api/fs/file?path=%2Ftmp%2Fgenerated.png",
				label: undefined,
			},
			{
				src: "/api/fs/file?path=%2Ftmp%2Fgenerated-2.png",
				label: undefined,
			},
		]);
	});

	it("extracts image previews from resource_link content", () => {
		const previews = extractToolImagePreviews({
			content: [
				{ type: "text", text: "Generated image." },
				{
					type: "resource_link",
					uri: "/api/fs/file?path=%2Ftmp%2Fgenerated.png",
					mimeType: "image/png",
					name: "generated.png",
				},
			],
		});

		expect(previews).toEqual([
			{
				src: "/api/fs/file?path=%2Ftmp%2Fgenerated.png",
				label: "generated.png",
			},
		]);
	});

	it("extracts image previews from artifact image blocks", () => {
		const previews = extractToolImagePreviews({
			artifact: [
				{
					type: "image",
					mimeType: "image/png",
					data: "abc123",
				},
			],
		});

		expect(previews).toEqual([
			{
				src: "data:image/png;base64,abc123",
			},
		]);
	});

	it("extracts audio previews from structured media output", () => {
		const previews = extractToolAudioPreviews({
			structuredContent: {
				media: [
					{
						modality: "audio",
						path: "/tmp/generated-sfx.wav",
						name: "impact.wav",
						mimeType: "audio/wav",
					},
					{
						modality: "audio",
						url: "/api/fs/file?path=%2Ftmp%2Fgenerated-sfx-2.wav",
						name: "reverb.wav",
						mimeType: "audio/wav",
					},
				],
			},
		});

		expect(previews).toEqual([
			{
				src: "/api/fs/file?path=%2Ftmp%2Fgenerated-sfx.wav",
				label: "impact.wav",
			},
			{
				src: "/api/fs/file?path=%2Ftmp%2Fgenerated-sfx-2.wav",
				label: "reverb.wav",
			},
		]);
	});

	it("extracts audio previews from resource_link content", () => {
		const previews = extractToolAudioPreviews({
			content: [
				{ type: "text", text: "Generated audio." },
				{
					type: "resource_link",
					uri: "/api/fs/file?path=%2Ftmp%2Fgenerated.mp3",
					mimeType: "audio/mpeg",
					name: "generated.mp3",
				},
			],
		});

		expect(previews).toEqual([
			{
				src: "/api/fs/file?path=%2Ftmp%2Fgenerated.mp3",
				label: "generated.mp3",
			},
		]);
	});

	it("renders image previews in tool details", () => {
		const html = renderToStaticMarkup(
			React.createElement(ToolEventPanel, {
				variant: "inline",
				toolEvents: [
					{
						id: "tool-image-1",
						name: "generate_image_or_texture",
						status: "completed",
						output: {
							structuredContent: {
								images: [{ path: "/tmp/generated.png" }],
							},
						},
					},
				],
			}),
		);

		expect(html).toContain("Images");
		expect(html).toContain('src="/api/fs/file?path=%2Ftmp%2Fgenerated.png"');
	});

	it("renders audio previews in tool details", () => {
		const html = renderToStaticMarkup(
			React.createElement(ToolEventPanel, {
				variant: "inline",
				toolEvents: [
					{
						id: "tool-audio-1",
						name: "generate_audio_or_music",
						status: "completed",
						output: {
							structuredContent: {
								media: [
									{
										modality: "audio",
										path: "/tmp/generated-sfx.wav",
										name: "impact.wav",
										mimeType: "audio/wav",
									},
								],
							},
						},
					},
				],
			}),
		);

		expect(html).toContain("Audio");
		expect(html).toContain("<audio");
		expect(html).toContain('src="/api/fs/file?path=%2Ftmp%2Fgenerated-sfx.wav"');
		expect(html).toContain("impact.wav");
	});
});
