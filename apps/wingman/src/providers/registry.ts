export type ProviderAuthType = "api-key" | "oauth";
export type ProviderCategory = "model" | "voice";
export type ProviderName =
	| "anthropic"
	| "openai"
	| "openrouter"
	| "copilot"
	| "xai"
	| "lmstudio"
	| "ollama"
	| "elevenlabs";

export interface ProviderOAuthConfig {
	authorizationUrl: string;
	tokenUrl: string;
	scopes?: string[];
	clientIdEnv: string[];
	clientSecretEnv?: string[];
	defaultClientId?: string;
	defaultClientSecret?: string;
	scopeSeparator?: string;
	redirectPath?: string;
	tokenResponseType?: "json" | "form";
	usePkce?: boolean;
	authorizationParams?: Record<string, string>;
	tokenParams?: Record<string, string>;
	tokenHeaders?: Record<string, string>;
}

export interface ProviderSpec {
	name: ProviderName;
	label: string;
	type: ProviderAuthType;
	envVars: string[];
	category: ProviderCategory;
	baseURL?: string;
	oauth?: ProviderOAuthConfig;
	requiresAuth?: boolean; // If false, API key is optional (e.g., local providers)
}

const PROVIDERS: Record<ProviderName, ProviderSpec> = {
	anthropic: {
		name: "anthropic",
		label: "Anthropic",
		type: "api-key",
		envVars: ["ANTHROPIC_API_KEY"],
		category: "model",
	},
	openai: {
		name: "openai",
		label: "OpenAI",
		type: "api-key",
		envVars: ["OPENAI_API_KEY"],
		category: "model",
	},
	openrouter: {
		name: "openrouter",
		label: "OpenRouter",
		type: "api-key",
		envVars: ["OPENROUTER_API_KEY"],
		baseURL: "https://openrouter.ai/api/v1",
		category: "model",
	},
	copilot: {
		name: "copilot",
		label: "GitHub Copilot",
		type: "api-key",
		envVars: ["GITHUB_COPILOT_TOKEN", "COPILOT_TOKEN", "COPILOT_API_KEY"],
		baseURL: "https://api.githubcopilot.com",
		category: "model",
	},
	xai: {
		name: "xai",
		label: "xAI",
		type: "api-key",
		envVars: ["XAI_API_KEY"],
		category: "model",
	},
	lmstudio: {
		name: "lmstudio",
		label: "LM Studio",
		type: "api-key",
		envVars: ["LMSTUDIO_API_KEY", "LM_STUDIO_API_KEY"],
		baseURL: "http://localhost:1234/v1",
		requiresAuth: false,
		category: "model",
	},
	ollama: {
		name: "ollama",
		label: "Ollama",
		type: "api-key",
		envVars: ["OLLAMA_API_KEY"],
		baseURL: "http://localhost:11434/v1",
		requiresAuth: false,
		category: "model",
	},
	elevenlabs: {
		name: "elevenlabs",
		label: "ElevenLabs",
		type: "api-key",
		envVars: ["ELEVENLABS_API_KEY", "XI_API_KEY"],
		category: "voice",
	},
};

export function normalizeProviderName(provider: string): ProviderName | undefined {
	const key = provider.trim().toLowerCase() as ProviderName;
	return PROVIDERS[key] ? key : undefined;
}

export function getProviderSpec(provider: string): ProviderSpec | undefined {
	const normalized = normalizeProviderName(provider);
	return normalized ? PROVIDERS[normalized] : undefined;
}

export function listProviderSpecs(category?: ProviderCategory): ProviderSpec[] {
	const providers = Object.values(PROVIDERS);
	if (!category) {
		return providers;
	}
	return providers.filter((provider) => provider.category === category);
}
