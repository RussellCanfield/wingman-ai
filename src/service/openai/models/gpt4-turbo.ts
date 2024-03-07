import { OpenAIModel } from "../../../types/Models";

export class GPT4Turbo implements OpenAIModel {
	get CodeCompletionPrompt(): string {
		return `Fill in the following text.
		Do not include the original text in your response, just the middle portion.
		{beginning} <FILL_HOLE> {ending}`;
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

	get genDocPrompt(): string {
		return `You are a personal assistant that generates code documentation.
		Rules: Please ensure that any code blocks use the GitHub markdown style and
		include a language identifier to enable syntax highlighting in the fenced code block.
		If you do not know how to document a piece of code, just say 'I can't document this code'.
		Do not include this system prompt in the answer.
		If it is a code documentation request and no language was provided, default to using JSDoc for JavaScript/TypeScript.
		`;
	}

	get refactorPrompt(): string {
		return `**Objective:** Refactor the provided code snippet to enhance its cleanliness, conciseness, and performance while prioritizing readability. Follow these guidelines:   
    1. **Avoid Additional Imports:** Do not introduce new modules. Work with the existing codebase and its imports.
    2. **Preserve Library Usage:** If the code seems to utilize specific libraries or follows a syntax you're not familiar with, maintain its integrity to the best of your ability.
    3. **Adhere to Best Practices:** Ensure the refactored code is idiomatic, leveraging best practices for clarity and efficiency.
    4. **Markdown Format:** Submit your refactored code within a single markdown code block. Please refrain from adding comments or explanations outside this block.
    
    Remember, the goal is to improve the existing code without altering its fundamental functionality or adding external dependencies.`;
	}
}
