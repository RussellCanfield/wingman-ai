import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import {
	buildToolActivityTickerLine,
	ToolActivityRollup,
} from "./ToolActivityRollup";

(globalThis as { React?: typeof React }).React = React;

describe("ToolActivityRollup", () => {
	it("renders an animated summary ticker and nested tool cards", () => {
		const html = renderToStaticMarkup(
			React.createElement(ToolActivityRollup, {
				toolEvents: [
					{
						id: "tool-1",
						name: "read_file",
						status: "completed",
						args: { file_path: "src/app.ts" },
						timestamp: 1,
					},
					{
						id: "tool-2",
						name: "edit_file",
						status: "running",
						args: { file_path: "src/app.ts", old_string: "a", new_string: "b" },
						timestamp: 2,
					},
				],
			}),
		);

		expect(html).toContain('data-testid="tool-activity-rollup"');
		expect(html).toContain('data-testid="tool-activity-rollup-ticker"');
		expect(html).toContain('data-testid="tool-activity-rollup-icon"');
		expect(html).toContain("tool-rollup-line");
		expect(html).toContain("Read src/app.ts");
		expect(html).toContain("Editing src/app.ts");
		expect(html).toContain("rounded-lg border border-white/10 bg-slate-950/45");
		expect(html).toContain("inline-flex h-7 w-7 shrink-0 items-center justify-center");
		expect(html).toContain("min-w-0 h-5 overflow-hidden");
	});

	it("builds concise ticker labels from tool metadata", () => {
		expect(
			buildToolActivityTickerLine({
				id: "tool-task",
				name: "task",
				status: "running",
				args: {
					subagent_type: "researcher",
					description: "Collect references",
				},
			}),
		).toBe("Delegating to researcher · Collect references");
	});

	it("extracts nested file paths into readable activity text", () => {
		expect(
			buildToolActivityTickerLine({
				id: "tool-read",
				name: "read_file",
				status: "completed",
				args: {
					input: {
						file_path: "/memories/agents/main/instructions.md",
					},
				},
			}),
		).toBe("Read main/instructions.md");
	});

	it("extracts file paths from stringified json args", () => {
		expect(
			buildToolActivityTickerLine({
				id: "tool-read-json",
				name: "functions.read_file",
				status: "completed",
				args: {
					input:
						'{"file_path":"/memories/hotlist.json","offset":0,"limit":200}',
				},
			}),
		).toBe("Read memories/hotlist.json");
	});
});
