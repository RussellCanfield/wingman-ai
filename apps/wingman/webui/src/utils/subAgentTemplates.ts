import type { AgentSummary } from "../types";

export type SubAgentTemplateOption = {
	id: string;
	label: string;
};

type BuildSubAgentTemplateOptionsInput = {
	agents: AgentSummary[];
	editingAgentId?: string | null;
};

export const buildSubAgentTemplateOptions = ({
	agents,
	editingAgentId,
}: BuildSubAgentTemplateOptionsInput): SubAgentTemplateOption[] => {
	const excludedId = editingAgentId?.trim().toLowerCase();

	return agents
		.filter((agent) => {
			if (!agent.id) return false;
			if (!excludedId) return true;
			return agent.id.trim().toLowerCase() !== excludedId;
		})
		.map((agent) => ({
			id: agent.id,
			label:
				agent.displayName && agent.displayName !== agent.id
					? `${agent.displayName} (${agent.id})`
					: agent.id,
		}));
};
