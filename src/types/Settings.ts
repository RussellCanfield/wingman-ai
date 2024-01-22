export const defaultMaxTokens = -1;

interface BaseServiceSettings {
	chatModel: string;
	codeModel: string;
	baseUrl: string;
}

export interface InteractionSettings {
	codeContextWindow: number;
	codeMaxTokens: number;
	chatContextWindow: number;
	chatMaxTokens: number;
}

export interface Settings {
	aiProvider: string;
	interactionSettings: InteractionSettings;
	ollama?: BaseServiceSettings & {
		apiPath: string;
		modelInfoPath: string;
	};
	huggingface?: BaseServiceSettings & {
		apiKey: string;
	};
}
