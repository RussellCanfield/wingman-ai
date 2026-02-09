export type KnownSubagentLookup = Map<string, string>;

const DIRECT_ACTOR_KEYS = [
	"subagent",
	"subAgent",
	"sub_agent",
	"subagentName",
	"subAgentName",
	"agent",
	"agentName",
	"agent_id",
	"agentId",
	"delegate",
	"delegateTo",
	"worker",
	"workerName",
	"assistant",
	"node",
	"langgraph_node",
	"langgraphNode",
];

function normalizeLookupKey(value: string): string {
	return value.trim().toLowerCase();
}

function expandActorCandidates(value: string): string[] {
	const trimmed = value.trim();
	if (!trimmed) return [];

	const results = new Set<string>([trimmed]);
	const withoutLanggraphPrefix = trimmed
		.replace(/^langgraph_node[:=]\s*/i, "")
		.trim();
	if (withoutLanggraphPrefix) {
		results.add(withoutLanggraphPrefix);
	}

	for (const part of withoutLanggraphPrefix.split(/[/:|>]/g)) {
		const segment = part.trim();
		if (!segment || segment.startsWith("__")) continue;
		results.add(segment);
	}

	for (const part of withoutLanggraphPrefix.split(".")) {
		const segment = part.trim();
		if (!segment || segment.startsWith("__")) continue;
		results.add(segment);
	}

	return Array.from(results.values());
}

function getSingleKnownSubagentLabel(
	knownSubagents?: KnownSubagentLookup,
): string | undefined {
	if (!knownSubagents || knownSubagents.size === 0) return undefined;
	const labels = new Set<string>();
	for (const label of knownSubagents.values()) {
		if (label && label.trim()) labels.add(label.trim());
	}
	if (labels.size !== 1) return undefined;
	return Array.from(labels.values())[0];
}

export function matchKnownSubagentLabel(
	candidate: string | undefined,
	knownSubagents?: KnownSubagentLookup,
): string | undefined {
	if (!candidate || !knownSubagents || knownSubagents.size === 0) {
		return undefined;
	}

	for (const part of expandActorCandidates(candidate)) {
		const label = knownSubagents.get(normalizeLookupKey(part));
		if (label) return label;
	}

	return undefined;
}

function extractActorFromPayload(
	payload: unknown,
	knownSubagents?: KnownSubagentLookup,
	depth = 0,
): string | null {
	if (!payload || typeof payload !== "object") return null;
	if (depth > 3) return null;

	if (Array.isArray(payload)) {
		for (const item of payload) {
			const nested = extractActorFromPayload(item, knownSubagents, depth + 1);
			if (nested) return nested;
		}
		return null;
	}

	const source = payload as Record<string, unknown>;
	for (const key of DIRECT_ACTOR_KEYS) {
		const value = source[key];
		if (typeof value !== "string" || !value.trim()) continue;
		const matched = matchKnownSubagentLabel(value, knownSubagents);
		if (matched) return matched;
		return value.trim();
	}

	for (const value of Object.values(source)) {
		if (!value || typeof value !== "object") continue;
		const nested = extractActorFromPayload(value, knownSubagents, depth + 1);
		if (nested) return nested;
	}

	return null;
}

export function resolveToolActorLabel(
	node: string | undefined,
	args: Record<string, any> | undefined,
	output: unknown,
	knownSubagents?: KnownSubagentLookup,
): string {
	const knownFromNode = matchKnownSubagentLabel(node, knownSubagents);
	if (knownFromNode) {
		return knownFromNode;
	}

	const inferred =
		extractActorFromPayload(args, knownSubagents) ||
		extractActorFromPayload(output, knownSubagents);
	if (inferred) {
		const knownFromInferred = matchKnownSubagentLabel(inferred, knownSubagents);
		if (knownFromInferred) return knownFromInferred;
		return inferred;
	}

	if (typeof node === "string" && node.trim().length > 0) {
		return node.trim();
	}

	const single = getSingleKnownSubagentLabel(knownSubagents);
	if (single) {
		return single;
	}

	return "orchestrator";
}
