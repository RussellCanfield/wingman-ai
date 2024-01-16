export interface AIModel {
	get CodeCompletionPrompt(): string;
	get ChatPrompt(): string;
}

export interface OllamaAIModel extends AIModel {}

export interface HuggingFaceAIModel extends AIModel {}
