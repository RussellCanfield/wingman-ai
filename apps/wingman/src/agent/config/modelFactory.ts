import { ChatAnthropic } from "@langchain/anthropic";
import type {
	BaseLanguageModel,
	BaseLanguageModelCallOptions,
} from "@langchain/core/language_models/base";
import { ChatOpenAI, type ChatOpenAIFields } from "@langchain/openai";
import { ChatXAI } from "@langchain/xai";
import {
	createCodexFetch,
	resolveCodexAuthFromFile,
} from "@/providers/codex.js";
import { createCopilotFetch } from "@/providers/copilot.js";
import { resolveProviderToken } from "@/providers/credentials.js";
import {
	getProviderSpec,
	listProviderSpecs,
	normalizeProviderName,
} from "@/providers/registry.js";
import { createLogger } from "../../logger.js";
import type { ReasoningEffort } from "./agentConfig.js";

const logger = createLogger();
const OPENAI_REASONING_MODEL_PATTERN =
	/(^|[/:._-])(gpt-5|o1|o3|o4|codex)([/:._-]|$)/i;
const ANTHROPIC_THINKING_MODEL_PATTERN = /claude-(3-7|sonnet-4|opus-4|4)/i;
const ANTHROPIC_THINKING_BUDGETS: Record<ReasoningEffort, number> = {
	minimal: 1024,
	low: 2048,
	medium: 4096,
	high: 8192,
};

export type ModelCreationOptions = {
	reasoningEffort?: ReasoningEffort;
	ownerLabel?: string;
};

/**
 * Create a LangChain model from a model string
 *
 * Format: "provider:model-name"
 * Examples:
 *  - "anthropic:claude-opus-4-5"
 *  - "anthropic:claude-sonnet-4-5"
 *  - "openai:gpt-4o"
 *  - "openai:gpt-4-turbo"
 *  - "codex:codex-mini-latest"
 *  - "openrouter:openai/gpt-4o"
 *  - "copilot:gpt-4o"
 */
export class ModelFactory {
	/**
	 * Parse and create a model from a string specification
	 */
	static createModel(
		modelString: string,
		options: ModelCreationOptions = {},
	): string | BaseLanguageModel<any, BaseLanguageModelCallOptions> | undefined {
		const separatorIndex = modelString.indexOf(":");
		if (separatorIndex === -1) {
			throw new Error(
				`Invalid model format: "${modelString}". Expected format: "provider:model-name"`,
			);
		}

		const provider = modelString.slice(0, separatorIndex);
		const model = modelString.slice(separatorIndex + 1);

		if (!provider || !model) {
			throw new Error(
				`Invalid model format: "${modelString}". Both provider and model name are required.`,
			);
		}

		const normalizedProvider = normalizeProviderName(provider);
		const providerSpec = normalizedProvider
			? getProviderSpec(normalizedProvider)
			: undefined;
		if (!providerSpec || providerSpec.category !== "model") {
			const supported = listProviderSpecs("model")
				.map((item) => item.name)
				.join(", ");
			throw new Error(
				`Unknown model provider: "${provider}". Supported providers: ${supported}`,
			);
		}

		logger.debug(`Creating model: ${normalizedProvider}:${model}`);

		switch (providerSpec.name) {
			case "anthropic":
				return ModelFactory.createAnthropicModel(model, options);

			case "openai":
				return ModelFactory.createOpenAIModel(model, options);

			case "codex":
				return ModelFactory.createCodexModel(model, options);

			case "openrouter":
				return ModelFactory.createOpenRouterModel(model, options);

			case "copilot":
				return ModelFactory.createCopilotModel(model, options);

			case "xai":
				return ModelFactory.createXAIModel(model, options);

			case "lmstudio":
				return ModelFactory.createLMStudioModel(model, options);

			case "ollama":
				return ModelFactory.createOllamaModel(model, options);
		}
	}

	/**
	 * Validate model string format without creating the model
	 */
	static validateModelString(modelString: string): {
		valid: boolean;
		error?: string;
	} {
		const separatorIndex = modelString.indexOf(":");
		if (separatorIndex === -1) {
			return {
				valid: false,
				error: `Invalid format: "${modelString}". Expected format: "provider:model-name"`,
			};
		}

		const provider = modelString.slice(0, separatorIndex);
		const model = modelString.slice(separatorIndex + 1);

		if (!provider || !model) {
			return {
				valid: false,
				error: "Both provider and model name are required",
			};
		}

		const normalizedProvider = normalizeProviderName(provider);
		const providerSpec = normalizedProvider
			? getProviderSpec(normalizedProvider)
			: undefined;
		if (!providerSpec || providerSpec.category !== "model") {
			const supported = listProviderSpecs("model")
				.map((item) => item.name)
				.join(", ");
			return {
				valid: false,
				error: `Unknown provider: "${provider}". Supported: ${supported}`,
			};
		}

		return { valid: true };
	}

	private static createAnthropicModel(
		model: string,
		options: ModelCreationOptions,
	): BaseLanguageModel {
		const token = resolveProviderToken("anthropic").token;
		const params: {
			model: string;
			temperature: number;
			apiKey?: string;
			thinking?: { type: "enabled"; budget_tokens: number };
		} = {
			model,
			temperature: 1,
		};

		if (token) {
			params.apiKey = token;
		}

		ModelFactory.applyAnthropicThinkingEffort(
			params,
			"anthropic",
			model,
			options,
		);

		return new ChatAnthropic(params);
	}

	private static createOpenAIModel(
		model: string,
		options: ModelCreationOptions,
	): BaseLanguageModel {
		const token = resolveProviderToken("openai").token;
		const params: ChatOpenAIFields = {
			model,
			temperature: 1,
			// Force the unified Responses API to support newer OpenAI model families
			// that are not available through /v1/chat/completions.
			useResponsesApi: true,
		};

		if (token) {
			params.apiKey = token;
		}

		ModelFactory.applyOpenAIReasoningEffort(params, "openai", model, options);

		return new ChatOpenAI(params);
	}

	private static createCodexModel(
		model: string,
		options: ModelCreationOptions,
	): BaseLanguageModel {
		const provider = getProviderSpec("codex");
		const token = resolveProviderToken("codex").token;
		const codexAuth = resolveCodexAuthFromFile();
		const params: ChatOpenAIFields = {
			model,
			useResponsesApi: true,
			// Codex endpoint requires store=false and does not persist response items.
			// Enabling ZDR keeps LangChain from replaying persisted response item ids.
			zdrEnabled: true,
			apiKey: token ?? "codex",
			configuration: {
				baseURL: provider?.baseURL,
				fetch: createCodexFetch({
					fallbackToken: token,
					fallbackAccountId: codexAuth.accountId,
				}),
			},
		};

		ModelFactory.applyOpenAIReasoningEffort(params, "codex", model, options);

		return new ChatOpenAI(params);
	}

	private static createOpenRouterModel(
		model: string,
		options: ModelCreationOptions,
	): BaseLanguageModel {
		const token = resolveProviderToken("openrouter").token ?? "";
		const provider = getProviderSpec("openrouter");
		const params: ChatOpenAIFields = {
			model,
			temperature: 1,
			apiKey: token,
			configuration: {
				baseURL: provider?.baseURL,
			},
		};

		ModelFactory.applyOpenAIReasoningEffort(
			params,
			"openrouter",
			model,
			options,
		);

		return new ChatOpenAI(params);
	}

	private static createCopilotModel(
		model: string,
		options: ModelCreationOptions,
	): BaseLanguageModel {
		const provider = getProviderSpec("copilot");
		const params: ChatOpenAIFields = {
			model,
			temperature: 1,
			apiKey: "copilot",
			configuration: {
				baseURL: provider?.baseURL,
				fetch: createCopilotFetch(),
			},
		};

		ModelFactory.applyOpenAIReasoningEffort(params, "copilot", model, options);

		return new ChatOpenAI(params);
	}

	private static createXAIModel(
		model: string,
		options: ModelCreationOptions,
	): BaseLanguageModel {
		const token = resolveProviderToken("xai").token;
		const params: { model: string; temperature: number; apiKey?: string } = {
			model,
			temperature: 1,
		};

		if (token) {
			params.apiKey = token;
		}

		if (options.reasoningEffort) {
			ModelFactory.warnUnsupportedReasoningEffort(
				"xai",
				model,
				options.reasoningEffort,
				options.ownerLabel,
			);
		}

		return new ChatXAI(params);
	}

	private static createLMStudioModel(
		model: string,
		options: ModelCreationOptions,
	): BaseLanguageModel {
		const tokenResult = resolveProviderToken("lmstudio");
		const provider = getProviderSpec("lmstudio");

		// Use fallback API key if no token configured (local servers often don't require auth)
		const apiKey = tokenResult.token ?? "lm-studio";
		const params: ChatOpenAIFields = {
			model,
			temperature: 1,
			apiKey: apiKey,
			configuration: {
				baseURL: provider?.baseURL,
			},
		};

		ModelFactory.applyOpenAIReasoningEffort(params, "lmstudio", model, options);

		return new ChatOpenAI(params);
	}

	private static createOllamaModel(
		model: string,
		options: ModelCreationOptions,
	): BaseLanguageModel {
		const tokenResult = resolveProviderToken("ollama");
		const provider = getProviderSpec("ollama");

		// Use fallback API key if no token configured (local servers often don't require auth)
		const apiKey = tokenResult.token ?? "ollama";
		const params: ChatOpenAIFields = {
			model,
			temperature: 1,
			apiKey: apiKey,
			configuration: {
				baseURL: provider?.baseURL,
			},
		};

		ModelFactory.applyOpenAIReasoningEffort(params, "ollama", model, options);

		return new ChatOpenAI(params);
	}

	private static applyOpenAIReasoningEffort(
		params: ChatOpenAIFields,
		provider: string,
		model: string,
		options: ModelCreationOptions,
	): void {
		const effort = options.reasoningEffort;
		if (!effort) {
			return;
		}
		if (!ModelFactory.supportsOpenAIReasoningEffort(provider, model)) {
			ModelFactory.warnUnsupportedReasoningEffort(
				provider,
				model,
				effort,
				options.ownerLabel,
			);
			return;
		}

		(
			params as ChatOpenAIFields & {
				reasoning?: { effort: ReasoningEffort };
			}
		).reasoning = { effort };
	}

	private static applyAnthropicThinkingEffort(
		params: {
			thinking?: { type: "enabled"; budget_tokens: number };
		},
		provider: string,
		model: string,
		options: ModelCreationOptions,
	): void {
		const effort = options.reasoningEffort;
		if (!effort) {
			return;
		}
		if (!ModelFactory.supportsAnthropicThinking(model)) {
			ModelFactory.warnUnsupportedReasoningEffort(
				provider,
				model,
				effort,
				options.ownerLabel,
			);
			return;
		}

		params.thinking = {
			type: "enabled",
			budget_tokens: ANTHROPIC_THINKING_BUDGETS[effort],
		};
	}

	private static supportsOpenAIReasoningEffort(
		provider: string,
		model: string,
	): boolean {
		if (provider !== "openai" && provider !== "codex") {
			return false;
		}
		return OPENAI_REASONING_MODEL_PATTERN.test(model.trim());
	}

	private static supportsAnthropicThinking(model: string): boolean {
		return ANTHROPIC_THINKING_MODEL_PATTERN.test(model.trim().toLowerCase());
	}

	private static warnUnsupportedReasoningEffort(
		provider: string,
		model: string,
		effort: ReasoningEffort,
		ownerLabel?: string,
	): void {
		const prefix = ownerLabel ? `${ownerLabel}: ` : "";
		logger.warn(
			`${prefix}model "${provider}:${model}" does not support reasoningEffort="${effort}". Ignoring and continuing.`,
		);
	}
}
