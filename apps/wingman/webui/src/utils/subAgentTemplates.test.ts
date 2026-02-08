import { describe, expect, it } from "vitest";
import { buildSubAgentTemplateOptions } from "./subAgentTemplates";

describe("buildSubAgentTemplateOptions", () => {
	it("returns all agents when not editing", () => {
		const result = buildSubAgentTemplateOptions({
			agents: [
				{ id: "main", displayName: "Main", tools: [] },
				{ id: "planner", displayName: "Planner", tools: [] },
			],
		});

		expect(result).toEqual([
			{ id: "main", label: "Main (main)" },
			{ id: "planner", label: "Planner (planner)" },
		]);
	});

	it("excludes current agent when editing", () => {
		const result = buildSubAgentTemplateOptions({
			agents: [
				{ id: "main", displayName: "Main", tools: [] },
				{ id: "planner", displayName: "Planner", tools: [] },
			],
			editingAgentId: "main",
		});

		expect(result).toEqual([{ id: "planner", label: "Planner (planner)" }]);
	});

	it("matches exclusion case-insensitively", () => {
		const result = buildSubAgentTemplateOptions({
			agents: [
				{ id: "Main", displayName: "Main", tools: [] },
				{ id: "planner", displayName: "planner", tools: [] },
			],
			editingAgentId: "main",
		});

		expect(result).toEqual([{ id: "planner", label: "planner" }]);
	});
});
