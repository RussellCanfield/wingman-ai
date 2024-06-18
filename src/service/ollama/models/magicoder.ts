import { OllamaAIModel } from "../types/index";

export class Magicoder extends OllamaAIModel {
	get CodeCompletionPrompt(): string {
		return `<｜fim▁begin｜>{beginning}<｜fim▁hole｜>{ending}<｜fim▁end｜>`;
	}
}
