import type { WingmanConfig } from "./schema";
import { ChatOpenAI } from "@langchain/openai";
import { ChatAnthropic } from "@langchain/anthropic";
import type { BaseChatModel } from "@langchain/core/language_models/chat_models";

export const createModel = (config: WingmanConfig): BaseChatModel => {
	switch (config.provider) {
		case "openai":
			return new ChatOpenAI({
				model: config.model,
				temperature: 0,
			});
		case "anthropic":
			return new ChatAnthropic({
				model: config.model,
				temperature: 0,
			});
		default:
			throw new Error(`Unsupported provider: ${config.provider}`);
	}
};
