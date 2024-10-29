import { OllamaAIModel } from "../types/index";

export class Deepseek extends OllamaAIModel {
	get CodeCompletionPrompt(): string {
		return `<｜begin▁of▁sentence｜>system
You are a coding assistant that helps complete code snippets, ensuring every modification is fully integrated.<｜end▁of▁sentence｜>

<｜begin▁of▁sentence｜>user
- Preserve the code's structure, order, comments, and indentation exactly.
- Do not include any additional text, explanations, placeholders, ellipses, or code fences.

{context}

<｜fim▁begin｜>{beginning}<｜fim▁hole｜>{ending}<｜fim▁end｜>`;
	}
}
