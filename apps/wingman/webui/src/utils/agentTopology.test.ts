import { describe, expect, it } from "vitest";
import type { AgentSummary } from "../types";
import {
	buildAgentTopologyGraph,
	TOPOLOGY_NODE_HEIGHT,
	TOPOLOGY_NODE_WIDTH,
} from "./agentTopology";

function rectsOverlap(
	a: { x: number; y: number },
	b: { x: number; y: number },
): boolean {
	return (
		a.x < b.x + TOPOLOGY_NODE_WIDTH &&
		a.x + TOPOLOGY_NODE_WIDTH > b.x &&
		a.y < b.y + TOPOLOGY_NODE_HEIGHT &&
		a.y + TOPOLOGY_NODE_HEIGHT > b.y
	);
}

describe("agentTopology", () => {
	it("lays out dense topology nodes without overlap", () => {
		const agents: AgentSummary[] = [
			{
				id: "game-dev",
				displayName: "game-dev",
				tools: ["task"],
				subAgents: [
					{ id: "art", displayName: "art-generation", tools: [] },
					{ id: "asset", displayName: "asset-refinement", tools: [] },
					{ id: "plan", displayName: "planning-idea", tools: [] },
					{ id: "ui", displayName: "ui-specialist", tools: [] },
					{ id: "impl", displayName: "implementor", tools: [] },
				],
			},
			{
				id: "stock-trader",
				displayName: "stock-trader",
				tools: ["task"],
				subAgents: [
					{ id: "goal", displayName: "goal-translator", tools: [] },
					{ id: "risk", displayName: "risk", tools: [] },
					{ id: "chain", displayName: "chain-curator", tools: [] },
					{ id: "selection", displayName: "selection", tools: [] },
				],
			},
			{
				id: "main",
				displayName: "main",
				tools: [],
				subAgents: [],
			},
			{
				id: "grok-image",
				displayName: "Grok Image",
				tools: [],
				subAgents: [],
			},
		];

		const graph = buildAgentTopologyGraph(agents, null);

		for (const node of graph.nodes) {
			expect(node.draggable).toBe(false);
		}

		for (let index = 0; index < graph.nodes.length; index += 1) {
			for (let compareIndex = index + 1; compareIndex < graph.nodes.length; compareIndex += 1) {
				const left = graph.nodes[index];
				const right = graph.nodes[compareIndex];
				expect(
					rectsOverlap(left.position, right.position),
					`nodes overlap: ${left.id} and ${right.id}`,
				).toBe(false);
			}
		}
	});

	it("highlights the selected node", () => {
		const agents: AgentSummary[] = [
			{
				id: "main",
				displayName: "main",
				tools: [],
				subAgents: [{ id: "coding", displayName: "coding", tools: [] }],
			},
		];

		const graph = buildAgentTopologyGraph(agents, "agent-main-sub-coding");
		const selectedNode = graph.nodes.find(
			(node) => node.id === "agent-main-sub-coding",
		);
		const unselectedNode = graph.nodes.find((node) => node.id === "agent-main");

		expect(selectedNode).toBeDefined();
		expect(unselectedNode).toBeDefined();
		expect(String(selectedNode?.style?.borderColor || "")).toContain("56, 189, 248");
		expect(String(unselectedNode?.style?.borderColor || "")).not.toContain(
			"56, 189, 248",
		);
	});
});
