import type { WingmanConfig } from "./schema";
import { ChatOpenAI } from "@langchain/openai";
import { ChatAnthropic } from "@langchain/anthropic";
import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import type { BaseChatModel } from "@langchain/core/language_models/chat_models";
import { ChatXAI } from "@langchain/xai";

export const createModel = (config: WingmanConfig): BaseChatModel => {
	switch (config.provider) {
		case "openai":
			return new ChatOpenAI({
				model: config.model,
				temperature: 0,
				apiKey: config.apiKey,
			});
		case "anthropic":
			return new ChatAnthropic({
				model: config.model,
				temperature: 0,
				apiKey: config.apiKey,
			});
		case "google":
			return new ChatGoogleGenerativeAI({
				model: config.model,
				temperature: 0,
				apiKey: config.apiKey,
			});
		case "xai":
			//@ts-expect-error
			return new ChatXAI({
				model: config.model,
				temperature: 0,
				apiKey: config.apiKey,
			});
		case "openrouter":
			return new ChatOpenAI({
				model: config.model,
				temperature: 0,
				openAIApiKey: config.apiKey,
				configuration: {
					baseURL: config.baseUrl || "https://api.openrouter.ai/v1",
				},
			});
		case "lmstudio":
			return new ChatOpenAI({
				model: config.model,
				temperature: 0,
				openAIApiKey: config.apiKey,
				configuration: {
					baseURL: config.baseUrl || "http://localhost:11434/v1",
				},
			});
		default:
			throw new Error(`Unsupported provider: ${config.provider}`);
	}
};
