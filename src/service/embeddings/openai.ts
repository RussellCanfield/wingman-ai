import { OpenAIEmbeddings } from "@langchain/openai";
import { OpenAIEmbeddingSettingsType } from "@shared/types/Settings";

export const getOpenAIEmbeddings = (settings: OpenAIEmbeddingSettingsType) => {
	return new OpenAIEmbeddings({
		model: settings.embeddingModel,
		apiKey: settings.apiKey,
	});
};
