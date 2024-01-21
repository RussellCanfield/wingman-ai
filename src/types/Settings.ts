export const defaultMaxTokens = 1024;

interface BaseServiceSettings {
	chatModel: string;
	codeModel: string;
	baseUrl: string;
	codeMaxTokens: number;
	chatMaxTokens: number;
}

export interface Settings {
	aiProvider: string;
	ollama?: BaseServiceSettings & {
		apiPath: string;
		modelInfoPath: string;
	};
	huggingface?: BaseServiceSettings & {
		apiKey: string;
	};
}
