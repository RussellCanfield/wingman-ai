export interface AIModel {
	get CodeCompletionPrompt(): string;
}

export interface HuggingFaceAIModel extends AIModel {}

export interface OpenAIModel extends AIModel {}

export interface AzureAIModel extends AIModel {}

export interface AnthropicModel extends AIModel {}

export interface FireworksModel extends AIModel {}

export interface xAIModel extends AIModel {}
