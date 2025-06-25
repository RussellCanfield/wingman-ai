const CONTEXT_WINDOWS: Record<string, number> = {
	"gpt-4.1": 1_000_000,
	"claude-opus-4": 200_000,
	"claude-sonnet-4": 200_000,
	"gemini-2.5-pro": 1_000_000,
};

export const getContextWindow = (model: string): number | undefined => {
	const modelKey = Object.keys(CONTEXT_WINDOWS).find((key) =>
		model.startsWith(key),
	);
	if (modelKey) {
		return CONTEXT_WINDOWS[modelKey];
	}
	return undefined;
};
