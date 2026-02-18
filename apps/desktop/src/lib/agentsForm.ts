import type {
	AgentDetail,
	AgentSummary,
	PromptTrainingConfig,
	SubAgentPayload,
} from "./gatewayModels.js";

export type AgentDraftSeed = {
	id: string;
	displayName: string;
	description: string;
	model: string;
	prompt: string;
	toolsCsv: string;
	promptTraining: boolean;
	selectedSubAgentIds: string[];
};

export function isPromptTrainingEnabled(value: PromptTrainingConfig | undefined): boolean {
	if (typeof value === "boolean") return value;
	if (!value || typeof value !== "object" || Array.isArray(value)) return false;
	if (Object.prototype.hasOwnProperty.call(value, "enabled")) {
		const enabled = (value as { enabled?: unknown }).enabled;
		if (typeof enabled === "boolean") return enabled;
	}
	return true;
}

export function parseToolsCsv(csv: string): string[] {
	return csv
		.split(",")
		.map((item) => item.trim())
		.filter(Boolean);
}

export function buildSubAgentCandidates(
	agents: AgentSummary[],
	currentAgentId: string,
): AgentSummary[] {
	return agents.filter((agent) => agent.id !== currentAgentId);
}

export function mapAgentDetailToDraftSeed(detail: AgentDetail): AgentDraftSeed {
	return {
		id: detail.id,
		displayName: detail.displayName || detail.id,
		description: detail.description || "",
		model: detail.model || "",
		prompt: detail.prompt || "",
		toolsCsv: (detail.tools || []).join(", "),
		promptTraining: isPromptTrainingEnabled(detail.promptTraining),
		selectedSubAgentIds: (detail.subAgents || []).map((sub) => sub.id),
	};
}

export function buildSubAgentPayloads(
	selectedIds: string[],
	detailsById: Record<string, AgentDetail>,
	currentAgentId: string,
): SubAgentPayload[] {
	const payloads: SubAgentPayload[] = [];
	for (const id of selectedIds) {
		if (!id || id === currentAgentId) continue;
		const detail = detailsById[id];
		if (!detail) continue;
		if (!detail.prompt?.trim()) continue;
		if (!detail.description?.trim()) continue;

		payloads.push({
			id,
			description: detail.description,
			prompt: detail.prompt,
			tools: detail.tools || [],
			model: detail.model || undefined,
			promptTraining: isPromptTrainingEnabled(detail.promptTraining),
		});
	}
	return payloads;
}
