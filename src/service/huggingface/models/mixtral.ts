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
}
