export interface AIModel {
	get CodeCompletionPrompt(): string;
	get ChatPrompt(): string;
	get genDocPrompt(): string;
}

export interface OllamaAIModel extends AIModel { }

export interface HuggingFaceAIModel extends AIModel { }

export interface OpenAIModel extends AIModel { }
