import { OllamaAIModel } from "../types/index";

export class CodeLlama extends OllamaAIModel {
	get CodeCompletionPrompt(): string {
		return "<PRE> {beginning} <SUF> {ending} <MID>";
	}
}
