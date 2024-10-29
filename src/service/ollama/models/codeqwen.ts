import { OllamaAIModel } from "../types/index";

export class CodeQwen extends OllamaAIModel {
	get CodeCompletionPrompt(): string {
		return `<|im_start|>system
You are a coding assistant that helps complete code snippets, ensuring every modification is fully integrated.<|im_end|>

<|im_start|>user
- Preserve the code's structure, order, comments, and indentation exactly.
- Do not include any additional text, explanations, placeholders, ellipses, or code fences.

{context}

<fim_prefix>{beginning}<fim_suffix>{ending}<fim_middle>`;
	}
}
