import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import {
	ToolEventPanel,
	formatToolEventDuration,
	summarizeToolEventValue,
	stringifyToolEventValue,
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
});
