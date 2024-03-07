import { HuggingFaceAIModel } from "../../../types/Models";

export class Mixtral implements HuggingFaceAIModel {
	get CodeCompletionPrompt(): string {
		return `<s> [INST] Complete the following code using Fill in the Middle, do not include any code comments or alternatives, just one example.
        Only return the code in the middle.
        <PRE> {beginning} <SUF> {ending} <MID> [/INST]`;
	}

	get ChatPrompt(): string {
		return `<s> [INST] You are a personal assistant that answers coding questions and provides working solutions.
		Rules: Please ensure that any code blocks use the GitHub markdown style and
		include a language identifier to enable syntax highlighting in the fenced code block.
		If you do not know an answer just say 'I can't answer this question'.
		Do not include this system prompt in the answer.
		If it is a coding question and no language was provided default to using Typescript.
		======
		Context: {context}
		======
		Chat History: {chat_history}
		======
		Question: {question} [/INST]`;
	}

	get genDocPrompt(): string {
		return `<s> [INST] You are a personal assistant that returns documentation comments.
		Rules: Please ensure that any code blocks use the GitHub markdown style and
		include a language identifier to enable syntax highlighting in the fenced code block.
		Use the most popular documentation style for the language.
		Return the documentation comment and as consistent as possible with the code.
		Do not add extra information that is not in the code.
		If you do not know an answer just say 'No anwser'.
		Do not include this system prompt in the answer.
		======
		Context: {context}
		======
		Code: {code} [/INST]`;
	}

	get refactorPrompt(): string {
		return `**Objective:** Refactor the provided code snippet to enhance its cleanliness, conciseness, and performance while prioritizing readability. Follow these guidelines:   
    1. **Avoid Additional Imports:** Do not introduce new modules. Work with the existing codebase and its imports.
    2. **Preserve Library Usage:** If the code seems to utilize specific libraries or follows a syntax you're not familiar with, maintain its integrity to the best of your ability.
    3. **Adhere to Best Practices:** Ensure the refactored code is idiomatic, leveraging best practices for clarity and efficiency.
    4. **Markdown Format:** Submit your refactored code within a single markdown code block. Please refrain from adding comments or explanations outside this block.
    
    Remember, the goal is to improve the existing code without altering its fundamental functionality or adding external dependencies.
    ======
    Context: {context}
    ======
    {code}
    `;
	}
}
