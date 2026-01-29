import { describe, it, expect } from "vitest";
import {
	extractSubagentName,
	extractTaskSummary,
	isTaskTool,
} from "../cli/ui/toolDisplayHelpers.js";

describe("toolDisplayHelpers", () => {
	it("detects Task tool names case-insensitively", () => {
		expect(isTaskTool("Task")).toBe(true);
		expect(isTaskTool("task")).toBe(true);
		expect(isTaskTool("TASK")).toBe(true);
		expect(isTaskTool("Other")).toBe(false);
	});

	it("extracts subagent names from common fields", () => {
		expect(extractSubagentName({ name: "Researcher" })).toBe("Researcher");
		expect(extractSubagentName({ agent: "Planner" })).toBe("Planner");
		expect(extractSubagentName({ subagent: "Runner" })).toBe("Runner");
		expect(extractSubagentName({ agent: { name: "Writer" } })).toBe("Writer");
	});

	it("extracts task summaries from common fields", () => {
		expect(extractTaskSummary({ task: "Find sources" })).toBe("Find sources");
		expect(extractTaskSummary({ prompt: "Summarize the doc" })).toBe(
			"Summarize the doc",
		);
		expect(extractTaskSummary({ description: "Investigate API" })).toBe(
			"Investigate API",
		);
	});
});
