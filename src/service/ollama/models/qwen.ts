import { OllamaAIModel } from "../types/index";

export class Qwen extends OllamaAIModel {
	get CodeCompletionPrompt(): string {
		return `<fim_prefix>{beginning}<fim_suffix>{ending}<fim_middle>`;
	}
}
