import { AIModel } from "@shared/types/Models";
import type { AIMessageChunk } from "@langchain/core/messages";
import { BaseChatModel } from "@langchain/core/language_models/chat_models";

export interface AIProvider {
	chatModel: AIModel | undefined;
	codeModel: AIModel | undefined;
	validateSettings(): Promise<boolean>;
	clearChatHistory(): void;
	codeComplete(
		beginning: string,
		ending: string,
		signal: AbortSignal,
		additionalContext?: string,
		recentClipboard?: string
	): Promise<string>;
	chat(
		prompt: string,
		ragContent: string,
		signal: AbortSignal
	): AsyncGenerator<string>;
	genCodeDocs(
		prompt: string,
		ragContent: string,
		signal: AbortSignal
	): Promise<string>;
	refactor(
		prompt: string,
		ragContent: string,
		signal: AbortSignal
	): Promise<string>;
	invoke(prompt: string): Promise<AIMessageChunk>;
	getModel(): BaseChatModel;
	getRerankModel(): BaseChatModel;
}

export interface AIStreamProvider extends AIProvider {
	codeCompleteStream(
		beginning: string,
		ending: string,
		signal: AbortSignal,
		additionalContext?: string,
		recentClipboard?: string
	): Promise<string>;
}

const Prompt_CodeComplete = `You are an senior software engineer, assit the user with completing their code.
When generating code focus on existing code style, syntax, and structure and follow use this as a guide.

The following are some of the types available in their file. 
Use these types while considering how to complete the code provided. 
Do not repeat or use these types in your answer.

{CONTEXT}

{CLIPBOARD}

{PROMPT}`;

export const buildCodeCompletePrompt = (
	prompt: string,
	clipboardContent: string,
	context: string
) => {
	return Prompt_CodeComplete.replace("{PROMPT}", prompt)
		.replace("{CLIPBOARD}", `${clipboardContent}\n\n------`)
		.replace("{CONTEXT}", `${context}\n\n------`);
};
