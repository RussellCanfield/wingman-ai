import { ChatAnthropic } from "@langchain/anthropic";
import { ChatOpenAI } from "@langchain/openai";
import type { BaseLanguageModel } from "@langchain/core/language_models/base";
import { createLogger } from "../../logger.js";

const logger = createLogger();

/**
 * Create a LangChain model from a model string
 *
 * Format: "provider:model-name"
 * Examples:
 *  - "anthropic:claude-opus-4-5"
 *  - "anthropic:claude-sonnet-4-5-20250929"
 *  - "openai:gpt-4o"
 *  - "openai:gpt-4-turbo"
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

		logger.debug(`Creating model: ${provider}:${model}`);

		switch (provider.toLowerCase()) {
			case "anthropic":
				return new ChatAnthropic({
					model,
					temperature: 0,
				});

			case "openai":
				return new ChatOpenAI({
					model,
					temperature: 0,
				});

			default:
				throw new Error(
					`Unknown model provider: "${provider}". Supported providers: anthropic, openai`,
				);
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

		const supportedProviders = ["anthropic", "openai"];
		if (!supportedProviders.includes(provider.toLowerCase())) {
			return {
				valid: false,
				error: `Unknown provider: "${provider}". Supported: ${supportedProviders.join(", ")}`,
			};
		}

		return { valid: true };
	}
}
