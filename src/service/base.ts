import { AIModel } from "@shared/types/Models";
import type { AIMessageChunk } from "@langchain/core/messages";
import { BaseChatModel } from "@langchain/core/language_models/chat_models";

export interface AIProvider {
	chatModel: AIModel | undefined;
	codeModel: AIModel | undefined;
	clearChatHistory(): void;
	codeComplete(
		beginning: string,
		ending: string,
		signal: AbortSignal,
		additionalContext?: string
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
}

export interface AIStreamProvicer extends AIProvider {
	codeCompleteStream(
		beginning: string,
		ending: string,
		signal: AbortSignal,
		additionalContext?: string
	): Promise<string>;
}
