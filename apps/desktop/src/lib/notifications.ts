type AgentCompletionNoticeInput = {
	agentId: string;
	threadName: string;
	preview?: string;
};

function normalizePreview(preview: string | undefined): string {
	const normalized = (preview || "").replace(/\s+/g, " ").trim();
	if (!normalized) return "";
	if (normalized.length <= 90) return normalized;
	return `${normalized.slice(0, 87)}...`;
}

export function buildAgentCompletionNotice(input: AgentCompletionNoticeInput): {
	title: string;
	body: string;
} {
	const title = `${input.agentId} finished`;
	const thread = input.threadName.trim() || "Current chat";
	const preview = normalizePreview(input.preview);
	const body = preview
		? `${thread}: ${preview}`
		: `${thread}: Response complete.`;
	return { title, body };
}
