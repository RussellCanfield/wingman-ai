export const defaultMaxTokens = -1;

interface BaseServiceSettings {
	chatModel: string;
	codeModel: string;
	baseUrl: string;
}

export interface InteractionSettings {
	codeStreaming: boolean,
	codeContextWindow: number;
	codeMaxTokens: number;
	chatContextWindow: number;
	chatMaxTokens: number;
}

const AiProviders = ["Ollama", "HuggingFace", "OpenAI"] as const;
export const AiProvidersList: string[] = [...AiProviders];

export type OllamaSettingsType = BaseServiceSettings & {
	apiPath: string;
	modelInfoPath: string;
};

export type ApiSettingsType = BaseServiceSettings & {
	apiKey: string;
};

export const defaultOllamaSettings: OllamaSettingsType = {
	codeModel: '',
	chatModel: '',
	baseUrl: 'http://localhost:11434',
	apiPath: '/api/generate',
	modelInfoPath: '/api/show'
};

export const defaultHfSettings: ApiSettingsType = {
	codeModel: 'codellama/CodeLlama-7b-hf',
	chatModel: 'mistralai/Mixtral-8x7B-Instruct-v0.1',
	baseUrl: 'https://api-inference.huggingface.co/models/',
	apiKey: 'Add me'
};

export const defaultOpenAISettings: ApiSettingsType = {
	chatModel: "gpt-4-0125-preview",
	codeModel: "gpt-4-0125-preview",
	baseUrl: "https://api.openai.com/v1/chat/completions",
	apiKey: 'Add me'
};

export interface Settings {
	aiProvider: typeof AiProviders[number];
	interactionSettings: InteractionSettings;
	ollama?: OllamaSettingsType;
	huggingface?: ApiSettingsType;
	openai?: ApiSettingsType;
}
