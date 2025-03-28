import { OllamaAIModel } from "../types/index";

export class Codestral extends OllamaAIModel {
	get CodeCompletionPrompt(): string {
		return "[SUFFIX]{ending}[PREFIX]{beginning}";
	}
}
