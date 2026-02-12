import { describe, expect, it } from "vitest";
import { buildRoutineAgents } from "./agentOptions";

describe("buildRoutineAgents", () => {
	it("builds options from catalog only", () => {
		const result = buildRoutineAgents({
			catalog: [
				{
					id: "coding",
					displayName: "Coding",
					description: "",
					tools: [],
				},
			],
		});

		expect(result).toEqual([
			{ id: "coding", name: "Coding" },
			{ id: "main", name: "Main" },
		]);
	});

	it("uses agent id when displayName is missing", () => {
		const result = buildRoutineAgents({
			catalog: [
				{
					id: "planner",
					displayName: "",
					description: "",
					tools: [],
				},
			],
		});

		expect(result).toEqual([
			{ id: "planner", name: "planner" },
			{ id: "main", name: "Main" },
		]);
	});

	it("does not duplicate main when already in catalog", () => {
		const result = buildRoutineAgents({
			catalog: [
				{
					id: "main",
					displayName: "Primary",
					description: "",
					tools: [],
				},
			],
		});

		expect(result).toEqual([{ id: "main", name: "Primary" }]);
	});
});
