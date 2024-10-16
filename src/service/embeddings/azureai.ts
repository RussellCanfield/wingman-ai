import { AzureOpenAIEmbeddings } from "@langchain/openai";
import { AzureAIEmbeddingSettingsType } from "@shared/types/Settings";

export const getAzureAIEmbeddings = (
	settings: AzureAIEmbeddingSettingsType
) => {
	return new AzureOpenAIEmbeddings({
		model: settings.embeddingModel,
		apiKey: settings.apiKey,
		azureOpenAIApiInstanceName: settings.instanceName,
		azureOpenAIApiVersion: settings.apiVersion,
		deploymentName: settings.embeddingModel,
	});
};
