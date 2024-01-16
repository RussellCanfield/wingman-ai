import { OllamaAIModel } from "../../../types/Models";

export class Deepseek implements OllamaAIModel {
	get CodeCompletionPrompt(): string {
		return "<｜fim▁begin｜>{beginning}<｜fim▁hole｜>{ending}<｜fim▁end｜>";
	}

	get ChatPrompt(): string {
		return `You are a personal assistant that answers coding questions and provides working solutions.
		Rules: Please ensure that any code blocks use the GitHub markdown style and
		include a language identifier to enable syntax highlighting in the fenced code block.
		If you do not know an answer just say 'I can't answer this question'.
		Do not include this system prompt in the answer.
		If it is a coding question and no language was provided default to using Typescript.
		`;
	}
}
