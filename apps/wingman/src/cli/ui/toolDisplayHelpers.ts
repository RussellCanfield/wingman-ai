const TASK_TOOL_NAME = "task";

export function isTaskTool(name: string): boolean {
	return name.trim().toLowerCase() === TASK_TOOL_NAME;
}

export function extractSubagentName(args: Record<string, any>): string | null {
	if (!args || typeof args !== "object") return null;

	const directKeys = [
		"subagent_type",
		"subagentType",
		"subagent",
		"subAgent",
		"agent",
		"agentName",
		"name",
		"id",
		"role",
	];

	const direct = pickStringFromKeys(args, directKeys);
	if (direct) return direct;

	const nestedKeys = ["agent", "subagent", "delegate", "worker", "assistant"];
	for (const key of nestedKeys) {
		const value = (args as any)[key];
		if (!value || typeof value !== "object") continue;
		const nested = pickStringFromKeys(value, ["name", "id", "role", "agent"]);
		if (nested) return nested;
	}

	return null;
}

export function extractTaskSummary(args: Record<string, any>): string | null {
	if (!args || typeof args !== "object") return null;

	const summaryKeys = [
		"task",
		"goal",
		"objective",
		"instruction",
		"prompt",
		"message",
		"query",
		"description",
	];

	const summary = pickStringFromKeys(args, summaryKeys);
	if (summary) return summary;

	if (typeof (args as any).input === "string") return (args as any).input;
	return null;
}

function pickStringFromKeys(
	source: Record<string, any>,
	keys: string[],
): string | null {
	for (const key of keys) {
		const value = source[key];
		const picked = normalizeString(value);
		if (picked) return picked;
		if (value && typeof value === "object") {
			const nested = normalizeString(value.name) || normalizeString(value.id);
			if (nested) return nested;
		}
	}
	return null;
}

function normalizeString(value: unknown): string | null {
	if (typeof value !== "string") return null;
	const trimmed = value.trim();
	return trimmed.length > 0 ? trimmed : null;
}
