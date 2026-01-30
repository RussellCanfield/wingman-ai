export type ProviderAuthType = "api-key" | "oauth";
export type ProviderName =
	| "anthropic"
	| "openai"
	| "openrouter"
	| "copilot"
	| "xai"
	| "lmstudio"
	| "ollama";

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
	baseURL?: string;
	oauth?: ProviderOAuthConfig;
}

const PROVIDERS: Record<ProviderName, ProviderSpec> = {
	anthropic: {
		name: "anthropic",
		label: "Anthropic",
		type: "api-key",
		envVars: ["ANTHROPIC_API_KEY"],
	},
	openai: {
		name: "openai",
		label: "OpenAI",
		type: "api-key",
		envVars: ["OPENAI_API_KEY"],
	},
	openrouter: {
		name: "openrouter",
		label: "OpenRouter",
		type: "api-key",
		envVars: ["OPENROUTER_API_KEY"],
		baseURL: "https://openrouter.ai/api/v1",
	},
	copilot: {
		name: "copilot",
		label: "GitHub Copilot",
		type: "api-key",
		envVars: ["GITHUB_COPILOT_TOKEN", "COPILOT_TOKEN", "COPILOT_API_KEY"],
		baseURL: "https://api.githubcopilot.com",
	},
	xai: {
		name: "xai",
		label: "xAI",
		type: "api-key",
		envVars: ["XAI_API_KEY"],
	},
	lmstudio: {
		name: "lmstudio",
		label: "LM Studio",
		type: "api-key",
		envVars: ["LMSTUDIO_API_KEY", "LM_STUDIO_API_KEY"],
		baseURL: "http://localhost:1234/v1",
	},
	ollama: {
		name: "ollama",
		label: "Ollama",
		type: "api-key",
		envVars: ["OLLAMA_API_KEY"],
		baseURL: "http://localhost:11434/v1",
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

export function listProviderSpecs(): ProviderSpec[] {
	return Object.values(PROVIDERS);
}
