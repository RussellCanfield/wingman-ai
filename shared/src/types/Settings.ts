import type { ComposerState } from "./Composer";

export const defaultMaxTokens = -1;

export type IndexFile = {
	lastModified: number;
};

export interface WorkspaceSettings {
	threadIds?: string[];
	activeThreadId?: string;
}

export interface MCPTool {
	name: string;
}

export interface AppState {
	settings: WorkspaceSettings;
	theme: number;
	workspaceFolder: string;
	totalFiles: number;
	threads?: ComposerState[];
	activeThreadId?: string;
}

interface BaseServiceSettings {
	chatModel: string;
	codeModel: string;
	baseUrl: string;
}

export interface AgentSettings {
	midsceneEnabled?: boolean;
	vibeMode?: boolean;
	automaticallyFixDiagnostics?: boolean;
	playAudioAlert?: boolean;
}

export interface InteractionSettings {
	codeCompletionEnabled: boolean;
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
	"xAI",
	"Google",
	"LMStudio",
	"OpenRouter",
] as const;
export const AiProvidersList: string[] = [...AiProviders];

export const EmbeddingProviders = [
	"Ollama",
	"OpenAI",
	"AzureAI",
	"Google",
	"LMStudio",
	"OpenRouter",
] as const;
export const EmbeddingProvidersList: string[] = [...EmbeddingProviders];

// Create a type for AiProviders
export type AiProviders = (typeof AiProviders)[number];
export type EmbeddingProviders = (typeof EmbeddingProviders)[number];

export type ApiSettingsType = BaseServiceSettings & {
	apiKey: string;
};

export type OllamaSettingsType = BaseServiceSettings & {
	apiPath: string;
	modelInfoPath: string;
};

export type xAISettingsType = ApiSettingsType;

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
	codeContextWindow: 512,
	codeMaxTokens: 256,
	chatContextWindow: 4096,
	chatMaxTokens: 8192,
};

export const defaultAgentSettings: AgentSettings = {
	midsceneEnabled: false,
	automaticallyFixDiagnostics: false,
	vibeMode: true,
	playAudioAlert: false,
};

export const defaultxAISettings: xAISettingsType = {
	codeModel: "grok-beta",
	chatModel: "grok-beta",
	baseUrl: "https://api.x.ai/v1",
	apiKey: "",
};

export const defaultOllamaSettings: OllamaSettingsType = {
	codeModel: "deepseek-coder-v2:16b-lite-base-q4_0",
	chatModel: "deepseek-coder-v2:16b-lite-instruct-q4_0",
	baseUrl: "http://localhost:11434",
	apiPath: "/api/generate",
	modelInfoPath: "/api/show",
};

export const defaultLMStudioSettings: OllamaSettingsType = {
	codeModel: "qwen2.5-coder-14b-instruct",
	chatModel: "qwen2.5-coder-14b-instruct",
	baseUrl: "http://localhost:1234/v1",
	apiPath: "/chat/completions",
	modelInfoPath: "/models",
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

export const defaultOpenRouterSettings: ApiSettingsType = {
	chatModel: "deepseek/deepseek-v3-base:free",
	codeModel: "deepseek/deepseek-v3-base:free",
	baseUrl: "https://openrouter.ai/api/v1",
	apiKey: "",
};

export const defaultGoogleSettings: ApiSettingsType = {
	chatModel: "gemini-2.5-pro-exp-03-25",
	codeModel: "gemini-2.5-pro-exp-03-25",
	baseUrl: "https://generativelanguage.googleapis.com/v1beta/models",
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

export type Settings = {
	aiProvider: (typeof AiProviders)[number];
	interactionSettings: InteractionSettings;
	providerSettings: {
		Ollama?: OllamaSettingsType;
		HuggingFace?: ApiSettingsType;
		OpenAI?: ApiSettingsType;
		Anthropic?: AnthropicSettingsType;
		AzureAI?: AzureAISettingsType;
		xAI?: xAISettingsType;
		OpenRouter?: ApiSettingsType;
		LMStudio?: OllamaSettingsType;
		Google: ApiSettingsType;
	};
	agentSettings: AgentSettings;
	embeddingProvider: (typeof EmbeddingProviders)[number];
	embeddingSettings: {
		General: {
			enabled: boolean;
			globPattern: string;
		};
		Ollama?: Omit<OllamaSettingsType, "chatModel" | "codeModel"> & {
			model: string;
			summaryModel: string;
			dimensions: number;
		};
		OpenAI?: Omit<ApiSettingsType, "chatModel" | "codeModel"> & {
			model: string;
			summaryModel: string;
			dimensions: number;
		};
		AzureAI?: Omit<AzureAISettingsType, "chatModel" | "codeModel"> & {
			model: string;
			summaryModel: string;
			dimensions: number;
		};
		OpenRouter?: Omit<ApiSettingsType, "chatModel" | "codeModel"> & {
			model: string;
			summaryModel: string;
			dimensions: number;
		};
		LMStudio?: Omit<OllamaSettingsType, "chatModel" | "codeModel"> & {
			model: string;
			summaryModel: string;
			dimensions: number;
		};
		Google?: Omit<ApiSettingsType, "chatModel" | "codeModel"> & {
			model: string;
			summaryModel: string;
			dimensions: number;
		};
	};
};

export type EmbeddingSettingsType =
	| Settings["embeddingSettings"]["Ollama"]
	| Settings["embeddingSettings"]["AzureAI"]
	| Settings["embeddingSettings"]["OpenAI"]
	| Settings["embeddingSettings"]["OpenRouter"]
	| Settings["embeddingSettings"]["LMStudio"];

export const defaultSettings: Settings = {
	aiProvider: "Anthropic",
	interactionSettings: defaultInteractionSettings,
	providerSettings: {
		Ollama: defaultOllamaSettings,
		HuggingFace: defaultHfSettings,
		Anthropic: defaultAnthropicSettings,
		OpenAI: defaultOpenAISettings,
		AzureAI: defaultAzureAISettings,
		xAI: defaultxAISettings,
		OpenRouter: defaultOpenRouterSettings,
		LMStudio: defaultLMStudioSettings,
		Google: defaultGoogleSettings,
	},
	embeddingProvider: "OpenAI",
	embeddingSettings: {
		General: {
			enabled: true,
			globPattern: "",
		},
		Ollama: {
			...defaultOllamaSettings,
			model: "nomic-embed-text",
			summaryModel: "",
			dimensions: 768,
		},
		OpenAI: {
			...defaultOpenAISettings,
			model: "text-embedding-3-small",
			summaryModel: "gpt-4o-mini",
			dimensions: 1536,
		},
		AzureAI: {
			...defaultAzureAISettings,
			model: "text-embedding-3-small",
			summaryModel: "gpt-4o-mini",
			dimensions: 1536,
		},
		OpenRouter: {
			...defaultOpenRouterSettings,
			model: "nomic-embed-text",
			summaryModel: "",
			dimensions: 768,
		},
		LMStudio: {
			...defaultLMStudioSettings,
			model: "nomic-embed-text",
			summaryModel: "",
			dimensions: 768,
		},
		Google: {
			...defaultGoogleSettings,
			model: "gemini-embedding-exp-03-07",
			summaryModel: "gemini-2.0-flash",
			dimensions: 3072,
		},
	},
	agentSettings: defaultAgentSettings,
};
