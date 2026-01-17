const TOKEN_COSTS: Record<string, { input: number; output: number }> = {
	"gpt-4.1": {
		input: 2,
		output: 8,
	},
	"claude-opus-4": {
		input: 15,
		output: 75,
	},
	"claude-sonnet-4": {
		input: 3,
		output: 15,
	},
	"gemini-2.5-pro": {
		input: 1.25,
		output: 10.0,
	},
	"grok-4": {
		input: 3,
		output: 15,
	},
};

export const getModelCosts = (
	model: string,
): { input: number; output: number } | undefined => {
	const modelKey = Object.keys(TOKEN_COSTS).find((key) =>
		model.startsWith(key),
	);
	if (modelKey) {
		return TOKEN_COSTS[modelKey];
	}
	return undefined;
};
