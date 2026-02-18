import { describe, expect, test } from "vitest";
import {
	buildSubAgentCandidates,
	buildSubAgentPayloads,
	isPromptTrainingEnabled,
	mapAgentDetailToDraftSeed,
	parseToolsCsv,
} from "./agentsForm.js";

describe("agentsForm", () => {
	test("parses tool CSV safely", () => {
		expect(parseToolsCsv("a, b , ,c")).toEqual(["a", "b", "c"]);
	});

	test("normalizes promptTraining values correctly", () => {
		expect(isPromptTrainingEnabled({ enabled: true })).toBe(true);
		expect(
			isPromptTrainingEnabled({
				instructionsPath: "/memories/agents/main/instructions.md",
			}),
		).toBe(true);
		expect(isPromptTrainingEnabled({ enabled: false })).toBe(false);
		expect(isPromptTrainingEnabled(false)).toBe(false);
	});

	test("filters sub-agent candidates to exclude current agent", () => {
		const result = buildSubAgentCandidates(
			[
				{ id: "main", displayName: "Main", tools: [] },
				{ id: "planner", displayName: "Planner", tools: [] },
			],
			"main",
		);
		expect(result.map((item) => item.id)).toEqual(["planner"]);
	});

	test("maps agent detail to form seed", () => {
		const seed = mapAgentDetailToDraftSeed({
			id: "main",
			displayName: "Main",
			description: "desc",
			tools: ["think", "search"],
			prompt: "prompt",
			promptTraining: { enabled: true },
			subAgents: [{ id: "planner", description: "p", prompt: "go", tools: [] }],
		});
		expect(seed.promptTraining).toBe(true);
		expect(seed.selectedSubAgentIds).toEqual(["planner"]);
		expect(seed.toolsCsv).toBe("think, search");
	});

	test("builds sub-agent payloads from selected details and excludes self", () => {
		const payloads = buildSubAgentPayloads(
			["planner", "main"],
			{
				planner: {
					id: "planner",
					displayName: "Planner",
					description: "plan",
					tools: ["think"],
					prompt: "Plan tasks",
					promptTraining: { enabled: false },
				},
			},
			"main",
		);
		expect(payloads).toHaveLength(1);
		expect(payloads[0].id).toBe("planner");
		expect(payloads[0].promptTraining).toBe(false);
	});
});
