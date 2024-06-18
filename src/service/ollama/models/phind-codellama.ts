import { OllamaAIModel } from "../types/index";

export class PhindCodeLlama extends OllamaAIModel {
	get CodeCompletionPrompt(): string {
		return `<PRE> {beginning} <SUF> {ending} <MID>`;
	}
}
