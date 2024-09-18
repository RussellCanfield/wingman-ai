export const defaultMaxTokens = -1;

export type IndexFilter = {
	filter: string;
	exclusionFilter?: string;
};

interface BaseServiceSettings {
	chatModel: string;
	codeModel: string;
	baseUrl: string;
}

export interface BaseEmbeddingServiceSettings {
	embeddingModel: string;
	dimensions: number;
}

export interface InteractionSettings {
	codeCompletionEnabled: boolean;
	codeStreaming: boolean;
	codeContextWindow: number;
	codeMaxTokens: number;
	chatContextWindow: number;
	chatMaxTokens: number;
}

export const AiProviders = [
	"Ollama",
	"HuggingFace",
	"OpenAI",
	"Anthropic",
] as const;
export const AiProvidersList: string[] = [...AiProviders];

export const EmbeddingProviders = ["Ollama", "OpenAI"] as const;
export const EmbeddingProvidersList: string[] = [...EmbeddingProviders];

export type OllamaSettingsType = BaseServiceSettings & {
	apiPath: string;
	modelInfoPath: string;
};

export type OllamaEmbeddingSettingsType = BaseEmbeddingServiceSettings & {
	baseUrl: string;
};

export type OpenAIEmbeddingSettingsType = BaseEmbeddingServiceSettings & {
	apiKey: string;
};

export type ApiSettingsType = BaseServiceSettings & {
	apiKey: string;
};

export const defaultOllamaSettings: OllamaSettingsType = {
	codeModel: "deepseek-coder-v2:16b-lite-base-q4_0",
	chatModel: "deepseek-coder-v2:16b-lite-instruct-q4_0",
	baseUrl: "http://localhost:11434",
	apiPath: "/api/generate",
	modelInfoPath: "/api/show",
};

export const defaultOllamaEmbeddingSettings: OllamaEmbeddingSettingsType = {
	embeddingModel: "mxbai-embed-large",
	baseUrl: "http://localhost:11434",
	dimensions: 1024,
};

export const defaultHfSettings: ApiSettingsType = {
	codeModel: "codellama/CodeLlama-7b-hf",
	chatModel: "mistralai/Mixtral-8x7B-Instruct-v0.1",
	baseUrl: "https://api-inference.huggingface.co/models/",
	apiKey: "Add me",
};

export const defaultOpenAISettings: ApiSettingsType = {
	chatModel: "gpt-4o-2024-08-06",
	codeModel: "gpt-4o-2024-08-06",
	baseUrl: "https://api.openai.com/v1/chat/completions",
	apiKey: "Add me",
};

export const defaultOpenAIEmbeddingSettings: OpenAIEmbeddingSettingsType = {
	embeddingModel: "text-embedding-ada-002",
	dimensions: 1536,
	apiKey: "Add me",
};

export const defaultAnthropicSettings: ApiSettingsType = {
	chatModel: "claude-3-5-sonnet-20240620",
	codeModel: "claude-3-5-sonnet-20240620",
	baseUrl: "https://api.anthropic.com/v1",
	apiKey: "Add me",
};

export interface Settings {
	aiProvider: (typeof AiProviders)[number];
	interactionSettings: InteractionSettings;
	embeddingProvider: (typeof EmbeddingProviders)[number];
	ollamaEmeddingSettings?: OllamaEmbeddingSettingsType;
	openaiEmbeddingSettings?: OpenAIEmbeddingSettingsType;
	ollama?: OllamaSettingsType;
	huggingface?: ApiSettingsType;
	openai?: ApiSettingsType;
	anthropic?: ApiSettingsType;
}
