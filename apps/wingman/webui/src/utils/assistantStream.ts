export function mergeAssistantStreamText(
	existing: string,
	incoming: string,
): string {
	if (!incoming) return existing;
	if (!existing) return incoming;
	if (incoming.startsWith(existing)) return incoming;
	return `${existing}${incoming}`;
}
