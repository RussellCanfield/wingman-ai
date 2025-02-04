export interface AIModel {
	get CodeCompletionPrompt(): string;
	get ChatPrompt(): string;
	get genDocPrompt(): string;
	get refactorPrompt(): string;
}

export interface HuggingFaceAIModel extends AIModel { }

export interface OpenAIModel extends AIModel { }

export interface AzureAIModel extends AIModel { }

export interface AnthropicModel extends AIModel { }

export interface FireworksModel extends AIModel { }