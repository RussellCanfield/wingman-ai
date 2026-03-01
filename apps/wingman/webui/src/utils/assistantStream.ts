export function extractThinkBlocksForDisplay(text: string): string[] {
	if (!text) return [];
	const blocks: string[] = [];
	text.replace(/<think>([\s\S]*?)<\/think>/gi, (_, content) => {
		const trimmed = content.trim();
		if (trimmed) blocks.push(trimmed);
		return "";
	});
	// Include any in-progress (unclosed) block
	const lastOpenIdx = text.toLowerCase().lastIndexOf("<think>");
	if (lastOpenIdx !== -1) {
		const afterOpen = text.slice(lastOpenIdx + 7);
		if (!afterOpen.toLowerCase().includes("</think>")) {
			const trimmed = afterOpen.trim();
			if (trimmed) blocks.push(trimmed);
		}
	}
	return blocks;
}

export function stripThinkTokensForDisplay(text: string): string {
	if (!text) return text;
	// Remove complete <think>...</think> blocks
	let result = text.replace(/<think>[\s\S]*?<\/think>/gi, "");
	// Remove any in-progress <think> block (no closing tag yet)
	result = result.replace(/<think>[\s\S]*$/i, "");
	return result;
}

export function mergeAssistantStreamText(
	existing: string,
	incoming: string,
): string {
	if (!incoming) return existing;
	if (!existing) return incoming;
	if (incoming.startsWith(existing)) return incoming;
	return `${existing}${incoming}`;
}
