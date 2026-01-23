import { ChatAnthropic } from "@langchain/anthropic";
import { ChatOpenAI } from "@langchain/openai";
import type { BaseLanguageModel } from "@langchain/core/language_models/base";
import { createLogger } from "../../logger.js";
import { resolveProviderToken } from "@/providers/credentials.js";
import { createCopilotFetch } from "@/providers/copilot.js";
import {
	getProviderSpec,
	listProviderSpecs,
	normalizeProviderName,
} from "@/providers/registry.js";

const logger = createLogger();

/**
 * Create a LangChain model from a model string
 *
 * Format: "provider:model-name"
 * Examples:
 *  - "anthropic:claude-opus-4-5"
 *  - "anthropic:claude-sonnet-4-5"
 *  - "openai:gpt-4o"
 *  - "openai:gpt-4-turbo"
 *  - "openrouter:openai/gpt-4o"
 *  - "copilot:gpt-4o"
 */
export class ModelFactory {
	/**
	 * Parse and create a model from a string specification
	 */
	static createModel(modelString: string): BaseLanguageModel {
		const parts = modelString.split(":");
		if (parts.length !== 2) {
			throw new Error(
				`Invalid model format: "${modelString}". Expected format: "provider:model-name"`,
			);
		}

		const [provider, model] = parts;

		if (!provider || !model) {
			throw new Error(
				`Invalid model format: "${modelString}". Both provider and model name are required.`,
			);
		}

		const normalizedProvider = normalizeProviderName(provider);
		if (!normalizedProvider) {
			const supported = listProviderSpecs().map((item) => item.name).join(", ");
			throw new Error(
				`Unknown model provider: "${provider}". Supported providers: ${supported}`,
			);
		}

		logger.debug(`Creating model: ${normalizedProvider}:${model}`);

		switch (normalizedProvider) {
			case "anthropic":
				return ModelFactory.createAnthropicModel(model);

			case "openai":
				return ModelFactory.createOpenAIModel(model);

			case "openrouter":
				return ModelFactory.createOpenRouterModel(model);

			case "copilot":
				return ModelFactory.createCopilotModel(model);
		}
	}

	/**
	 * Validate model string format without creating the model
	 */
	static validateModelString(modelString: string): {
		valid: boolean;
		error?: string;
	} {
		const parts = modelString.split(":");
		if (parts.length !== 2) {
			return {
				valid: false,
				error: `Invalid format: "${modelString}". Expected format: "provider:model-name"`,
			};
		}

		const [provider, model] = parts;

		if (!provider || !model) {
			return {
				valid: false,
				error: "Both provider and model name are required",
			};
		}

		const normalizedProvider = normalizeProviderName(provider);
		if (!normalizedProvider) {
			const supported = listProviderSpecs().map((item) => item.name).join(", ");
			return {
				valid: false,
				error: `Unknown provider: "${provider}". Supported: ${supported}`,
			};
		}

		return { valid: true };
	}

	private static createAnthropicModel(model: string): BaseLanguageModel {
		const token = resolveProviderToken("anthropic").token;
		const params: { model: string; temperature: number; apiKey?: string } = {
			model,
			temperature: 0,
		};

		if (token) {
			params.apiKey = token;
		}

		return new ChatAnthropic(params);
	}

	private static createOpenAIModel(model: string): BaseLanguageModel {
		const token = resolveProviderToken("openai").token;
		const params: { model: string; temperature: number; apiKey?: string } = {
			model,
			temperature: 0,
		};

		if (token) {
			params.apiKey = token;
		}

		return new ChatOpenAI(params);
	}

	private static createOpenRouterModel(model: string): BaseLanguageModel {
		const token = resolveProviderToken("openrouter").token ?? "";
		const provider = getProviderSpec("openrouter");

		return new ChatOpenAI({
			model,
			temperature: 0,
			apiKey: token,
			configuration: {
				baseURL: provider?.baseURL,
			},
		});
	}

	private static createCopilotModel(model: string): BaseLanguageModel {
		const provider = getProviderSpec("copilot");

		return new ChatOpenAI({
			model,
			temperature: 0,
			apiKey: "copilot",
			configuration: {
				baseURL: provider?.baseURL,
				fetch: createCopilotFetch(),
			},
		});
	}
}
