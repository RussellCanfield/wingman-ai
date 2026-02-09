import { describe, expect, it } from "vitest";
import {
	matchKnownSubagentLabel,
	resolveToolActorLabel,
	type KnownSubagentLookup,
} from "./agentAttribution";

function createLookup(entries: Array<[string, string]>): KnownSubagentLookup {
	return new Map<string, string>(entries);
}

describe("agentAttribution", () => {
	it("matches known subagents from namespaced node strings", () => {
		const known = createLookup([["researcher", "Researcher"]]);

		expect(matchKnownSubagentLabel("langgraph_node:researcher", known)).toBe(
			"Researcher",
		);
		expect(matchKnownSubagentLabel("__pregel_pull/researcher:step", known)).toBe(
			"Researcher",
		);
	});

	it("prefers known subagent labels from node metadata", () => {
		const known = createLookup([["implementor", "Implementor"]]);

		const actor = resolveToolActorLabel("langgraph_node:implementor", undefined, undefined, known);

		expect(actor).toBe("Implementor");
	});

	it("extracts explicit actor keys from payloads", () => {
		const known = createLookup([["reviewer", "Reviewer"]]);

		const actor = resolveToolActorLabel(
			undefined,
			{ payload: { subagent: "reviewer" }, name: "internet_search" },
			undefined,
			known,
		);

		expect(actor).toBe("Reviewer");
	});

	it("does not treat generic name/id payload fields as actor labels", () => {
		const actor = resolveToolActorLabel(
			undefined,
			{ name: "internet_search", id: "tool-123" },
			undefined,
			undefined,
		);

		expect(actor).toBe("orchestrator");
	});

	it("falls back to only known subagent when exactly one exists", () => {
		const known = createLookup([
			["implementor", "Implementor"],
			["implementor worker", "Implementor"],
		]);

		const actor = resolveToolActorLabel(undefined, undefined, undefined, known);

		expect(actor).toBe("Implementor");
	});
});
