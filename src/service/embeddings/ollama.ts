import { OllamaEmbeddings } from "@langchain/ollama";
import { OllamaEmbeddingSettingsType } from "@shared/types/Settings";

export const getOllamaEmbeddings = (settings: OllamaEmbeddingSettingsType) => {
	return new OllamaEmbeddings({
		model: settings.embeddingModel,
		baseUrl: settings.baseUrl,
	});
};
