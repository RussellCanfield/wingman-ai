import { InteractionSettings, Settings } from "@shared/types/Settings";
import { AIStreamProvider } from "../base";
import { ILoggingProvider } from "@shared/types/Logger";
import { AnthropicModel, AzureAIModel } from "@shared/types/Models";
import { BaseChatModel } from "@langchain/core/language_models/chat_models";
import {
	AIMessageChunk,
	BaseMessage,
	BaseMessageChunk,
} from "@langchain/core/messages";
import { AzureChatOpenAI } from "@langchain/openai";
import { GPTModel } from "../openai/models/gptmodel";

export class AzureAI implements AIStreamProvider {
	chatHistory: BaseMessage[] = [];
	chatModel: AnthropicModel | undefined;
	codeModel: AnthropicModel | undefined;
	baseModel: BaseChatModel | undefined;
	rerankModel: BaseChatModel | undefined;

	constructor(
		private readonly settings: Settings["providerSettings"]["Anthropic"],
		private readonly interactionSettings: InteractionSettings,
		private readonly loggingProvider: ILoggingProvider
	) {
		if (!settings) {
			throw new Error("Unable to load AzureAI settings.");
		}

		if (!this.settings?.apiKey.trim()) {
			throw new Error("AzureAI API key is required.");
		}

		this.chatModel = this.getChatModel(this.settings.chatModel);
		this.codeModel = this.getCodeModel(this.settings.codeModel);

		this.baseModel = new AzureChatOpenAI({
			apiKey: this.settings.apiKey,
			model: this.settings.chatModel,
			temperature: 0, //Required for tool calling.
			maxTokens: this.interactionSettings.chatMaxTokens,
		});

		this.rerankModel = new AzureChatOpenAI({
			apiKey: this.settings.apiKey,
			model: this.settings.chatModel,
			temperature: 0,
			maxTokens: 4096,
		});
	}

	validateSettings(): Promise<boolean> {
		const isChatModelValid =
			this.settings?.chatModel?.startsWith("gpt-4") ||
			this.settings?.chatModel?.startsWith("o1") ||
			false;
		const isCodeModelValid =
			this.settings?.codeModel?.startsWith("gpt-4") ||
			this.settings?.codeModel?.startsWith("o1") ||
			false;
		return Promise.resolve(isChatModelValid && isCodeModelValid);
	}

	private getCodeModel(codeModel: string): AzureAIModel | undefined {
		switch (true) {
			case codeModel.startsWith("gpt-4") || codeModel.startsWith("o1"):
				return new GPTModel();
		}
	}

	private getChatModel(chatModel: string): AzureAIModel | undefined {
		switch (true) {
			case chatModel.startsWith("gpt-4") || chatModel.startsWith("o1"):
				return new GPTModel();
		}
	}

	codeCompleteStream(
		beginning: string,
		ending: string,
		signal: AbortSignal,
		additionalContext?: string,
		recentClipboard?: string
	): Promise<string> {
		throw new Error("Method not implemented.");
	}

	clearChatHistory(): void {
		this.chatHistory = [];
	}

	codeComplete(
		beginning: string,
		ending: string,
		signal: AbortSignal,
		additionalContext?: string,
		recentClipboard?: string
	): Promise<string> {
		throw new Error("Method not implemented.");
	}

	chat(
		prompt: string,
		ragContent: string,
		signal: AbortSignal
	): AsyncGenerator<string> {
		throw new Error("Method not implemented.");
	}

	genCodeDocs(
		prompt: string,
		ragContent: string,
		signal: AbortSignal
	): Promise<string> {
		throw new Error("Method not implemented.");
	}

	async refactor(
		prompt: string,
		ragContent: string,
		signal: AbortSignal
	): Promise<string> {
		const startTime = new Date().getTime();

		let systemPrompt = this.chatModel?.refactorPrompt;

		if (ragContent) {
			systemPrompt += ragContent;
		}

		systemPrompt += `\n\n${prompt}`;

		let response: BaseMessageChunk | undefined;
		try {
			response = await this.baseModel!.invoke(String(systemPrompt), {
				signal,
			});
		} catch (error) {
			return `AzureAI - Refactor request with model ${this.settings?.codeModel} failed with the following error: ${error}`;
		}

		const endTime = new Date().getTime();
		const executionTime = (endTime - startTime) / 1000;

		this.loggingProvider.logInfo(
			`Refactor Time To First Token execution time: ${executionTime} ms`
		);

		return response.content.toString();
	}

	invoke(prompt: string): Promise<AIMessageChunk> {
		return this.baseModel!.invoke(prompt);
	}

	getModel(): BaseChatModel {
		return this.baseModel!;
	}

	getRerankModel(): BaseChatModel {
		return this.rerankModel!;
	}
}
