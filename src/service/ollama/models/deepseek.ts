import { OllamaAIModel } from "../types/index";

export class Deepseek extends OllamaAIModel {
	get CodeCompletionPrompt(): string {
		return "<｜fim▁begin｜>{beginning}<｜fim▁hole｜>{ending}<｜fim▁end｜>";
	}
}
