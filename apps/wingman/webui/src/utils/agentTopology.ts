import type { CSSProperties } from "react";
import { Position } from "reactflow";
import type { Edge, Node } from "reactflow";
import type { AgentSummary, ReasoningEffort } from "../types";

export const TOPOLOGY_NODE_WIDTH = 168;
export const TOPOLOGY_NODE_HEIGHT = 52;

const ROOT_COLUMN_X = 32;
const CHILD_COLUMN_X = 340;
const GROUP_GAP_Y = 52;
const CHILD_ROW_GAP_Y = 110;
const ROOT_ROW_GAP_Y = 104;
const START_Y = 24;

export type AgentTopologyLookup = Record<
	string,
	{
		id: string;
		displayName: string;
		description?: string;
		tools: string[];
		model?: string;
		reasoningEffort?: ReasoningEffort;
		parentId?: string;
	}
>;

export type AgentTopologyGraph = {
	nodes: Array<Node<{ label: string }>>;
	edges: Array<Edge>;
	lookup: AgentTopologyLookup;
};

const baseNodeStyle: CSSProperties = {
	width: TOPOLOGY_NODE_WIDTH,
	height: TOPOLOGY_NODE_HEIGHT,
	borderRadius: 12,
	border: "1px solid rgba(148, 163, 184, 0.55)",
	background: "rgba(15, 23, 42, 0.94)",
	color: "rgb(226 232 240)",
	fontSize: 12,
	fontWeight: 600,
	padding: "10px 12px",
	display: "flex",
	alignItems: "center",
	justifyContent: "center",
	textAlign: "center",
	whiteSpace: "nowrap",
	overflow: "hidden",
	textOverflow: "ellipsis",
	boxShadow: "0 8px 20px rgba(2, 6, 23, 0.28)",
};

const rootNodeStyle: CSSProperties = {
	background: "rgba(15, 23, 42, 0.98)",
};

const childNodeStyle: CSSProperties = {
	background: "rgba(30, 41, 59, 0.95)",
};

const selectedNodeStyle: CSSProperties = {
	borderColor: "rgba(56, 189, 248, 0.95)",
	background: "rgba(8, 47, 73, 0.9)",
	boxShadow: "0 0 0 1px rgba(56, 189, 248, 0.5), 0 10px 24px rgba(2, 132, 199, 0.24)",
};

function buildNode(
	id: string,
	label: string,
	position: { x: number; y: number },
	options: { selected: boolean; root: boolean },
): Node<{ label: string }> {
	return {
		id,
		data: { label },
		position,
		targetPosition: Position.Left,
		sourcePosition: Position.Right,
		draggable: false,
		selectable: true,
		style: {
			...baseNodeStyle,
			...(options.root ? rootNodeStyle : childNodeStyle),
			...(options.selected ? selectedNodeStyle : {}),
		},
	};
}

export function buildAgentTopologyGraph(
	agents: AgentSummary[],
	selectedAgentNodeId: string | null = null,
): AgentTopologyGraph {
	const nodes: Array<Node<{ label: string }>> = [];
	const edges: Array<Edge> = [];
	const lookup: AgentTopologyLookup = {};

	let cursorY = START_Y;

	for (const agent of agents) {
		const id = `agent-${agent.id}`;
		const children = Array.isArray(agent.subAgents) ? agent.subAgents : [];
		const childCount = children.length;
		const childSpanHeight =
			childCount > 0
				? (childCount - 1) * CHILD_ROW_GAP_Y + TOPOLOGY_NODE_HEIGHT
				: TOPOLOGY_NODE_HEIGHT;
		const groupHeight = Math.max(TOPOLOGY_NODE_HEIGHT, childSpanHeight);
		const parentY = cursorY + (groupHeight - TOPOLOGY_NODE_HEIGHT) / 2;

		nodes.push(
			buildNode(id, agent.displayName, { x: ROOT_COLUMN_X, y: parentY }, {
				selected: selectedAgentNodeId === id,
				root: true,
			}),
		);

		lookup[id] = {
			id: agent.id,
			displayName: agent.displayName,
			description: agent.description,
			tools: agent.tools,
			model: agent.model,
			reasoningEffort: agent.reasoningEffort,
		};

		for (const [subIndex, subAgent] of children.entries()) {
			const subId = `${id}-sub-${subAgent.id}`;
			const childY = cursorY + subIndex * CHILD_ROW_GAP_Y;

			nodes.push(
				buildNode(subId, subAgent.displayName, { x: CHILD_COLUMN_X, y: childY }, {
					selected: selectedAgentNodeId === subId,
					root: false,
				}),
			);

			lookup[subId] = {
				id: subAgent.id,
				displayName: subAgent.displayName,
				description: subAgent.description,
				tools: subAgent.tools,
				model: subAgent.model,
				reasoningEffort: subAgent.reasoningEffort,
				parentId: agent.id,
			};

			edges.push({
				id: `${id}->${subId}`,
				source: id,
				target: subId,
				type: "smoothstep",
				animated: false,
				style: { stroke: "rgba(148, 163, 184, 0.55)", strokeWidth: 1.2 },
			});
		}

		const verticalStep = Math.max(ROOT_ROW_GAP_Y, groupHeight + GROUP_GAP_Y);
		cursorY += verticalStep;
	}

	return { nodes, edges, lookup };
}
