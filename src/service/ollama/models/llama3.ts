import { OllamaAIModel } from "../types/index";

export class Llama3 extends OllamaAIModel {
	get CodeCompletionPrompt(): string {
		return `<PRE> {beginning} <SUF> {ending} <MID>`;
	}
}
