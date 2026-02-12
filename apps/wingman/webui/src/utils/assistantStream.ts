export function mergeAssistantStreamText(
	existing: string,
	incoming: string,
): string {
	if (!incoming) return existing;
	return `${existing}${incoming}`;
}
