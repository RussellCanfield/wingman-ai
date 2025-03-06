import type { ComposerMessage } from "./Composer";

export const defaultMaxTokens = -1;

export interface Thread {
	id: string;
	title: string;
	createdAt: number;
	updatedAt: number;
	messages: ComposerMessage[];
	originatingThreadId?: string;
}

export interface WorkspaceSettings {
	threads?: Thread[];
	activeThreadId?: string;
}

export interface AppState {
	settings: WorkspaceSettings;
	theme: number;
	workspaceFolder: string;
	threads?: Thread[];
	activeThreadId?: string;
	totalFiles: number;
}

interface BaseServiceSettings {
	chatModel: string;
	codeModel: string;
	baseUrl: string;
}

export interface BaseEmbeddingServiceSettings {
	embeddingModel: string;
	dimensions: string;
	enabled: boolean;
}

export interface ValidationSettings {
	validationCommand?: string;
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
	"AzureAI",
] as const;
export const AiProvidersList: string[] = [...AiProviders];

// Create a type for AiProviders
export type AiProviders = (typeof AiProviders)[number];

export type OllamaSettingsType = BaseServiceSettings & {
	apiPath: string;
	modelInfoPath: string;
};

export type ApiSettingsType = BaseServiceSettings & {
	apiKey: string;
};

export type AnthropicSettingsType = {
	enableReasoning?: boolean;
	sparkMode?: boolean;
} & ApiSettingsType;

export type AzureAISettingsType = Omit<ApiSettingsType, "baseUrl"> & {
	apiVersion: string;
	instanceName: string;
};

export const defaultInteractionSettings: InteractionSettings = {
	codeCompletionEnabled: true,
	codeStreaming: false,
	codeContextWindow: 512,
	codeMaxTokens: 256,
	chatContextWindow: 4096,
	chatMaxTokens: 8192,
};

export const defaultValidationSettings: ValidationSettings = {
	validationCommand: "",
};

export const defaultOllamaSettings: OllamaSettingsType = {
	codeModel: "deepseek-coder-v2:16b-lite-base-q4_0",
	chatModel: "deepseek-coder-v2:16b-lite-instruct-q4_0",
	baseUrl: "http://localhost:11434",
	apiPath: "/api/generate",
	modelInfoPath: "/api/show",
};

export const defaultHfSettings: ApiSettingsType = {
	codeModel: "codellama/CodeLlama-7b-hf",
	chatModel: "mistralai/Mixtral-8x7B-Instruct-v0.1",
	baseUrl: "https://api-inference.huggingface.co/models/",
	apiKey: "",
};

export const defaultOpenAISettings: ApiSettingsType = {
	chatModel: "gpt-4o-2024-08-06",
	codeModel: "gpt-4o-2024-08-06",
	baseUrl: "https://api.openai.com/v1/chat/completions",
	apiKey: "",
};

export const defaultAnthropicSettings: ApiSettingsType = {
	chatModel: "claude-3-7-sonnet-latest",
	codeModel: "claude-3-5-haiku-latest",
	baseUrl: "https://api.anthropic.com/v1",
	apiKey: "",
};

export const defaultAzureAISettings: AzureAISettingsType = {
	chatModel: "gpt-4o",
	codeModel: "gpt-4o",
	instanceName: "",
	apiKey: "",
	apiVersion: "2024-06-01",
};

export type MCPToolConfig = {
	name: string;
	type: "command" | "sse";
	command?: string;
	endpoint?: string;
	verified?: boolean;
	tools?: Array<{ name: string }>;
};

export type Settings = {
	aiProvider: (typeof AiProviders)[number];
	interactionSettings: InteractionSettings;
	providerSettings: {
		Ollama?: OllamaSettingsType;
		HuggingFace?: ApiSettingsType;
		OpenAI?: ApiSettingsType;
		Anthropic?: AnthropicSettingsType;
		AzureAI?: AzureAISettingsType;
	};
	mcpTools?: MCPToolConfig[];
	validationSettings: {
		validationCommand?: string;
		midsceneEnabled?: boolean;
	};
};
