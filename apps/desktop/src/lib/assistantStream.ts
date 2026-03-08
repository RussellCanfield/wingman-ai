export function mergeAssistantStreamText(
	existing: string,
	incoming: string,
	isDelta?: boolean,
): string {
	if (!incoming) return existing;
	if (isDelta) {
		if (incoming.startsWith(existing)) return incoming;
		return existing + incoming;
	}
	if (!existing.trim()) return incoming;
	return `${existing}\n${incoming}`;
}
