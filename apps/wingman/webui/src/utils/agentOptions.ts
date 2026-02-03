import type { AgentSummary, ControlUiAgent } from "../types";

type RoutineAgentInput = {
	catalog: AgentSummary[];
	configAgents: ControlUiAgent[];
};

export const buildRoutineAgents = ({
	catalog,
	configAgents,
}: RoutineAgentInput): ControlUiAgent[] => {
	const options: ControlUiAgent[] = [];
	const seen = new Set<string>();

	const addAgent = (id: string, name?: string) => {
		if (!id || seen.has(id)) return;
		seen.add(id);
		options.push({ id, name });
	};

	for (const agent of catalog) {
		addAgent(agent.id, agent.displayName || agent.id);
	}

	for (const agent of configAgents) {
		addAgent(agent.id, agent.name || agent.id);
	}

	if (!seen.has("main")) {
		addAgent("main", "Main");
	}

	return options;
};
