import type { AIStreamProvider, ModelParams } from "../base";
import type { InteractionSettings, Settings } from "@shared/types/Settings";
import { SonnetModel } from "./models/sonnet";
import type { AnthropicModel } from "@shared/types/Models";
import { truncateChatHistory } from "../utils/contentWindow";
import type { BaseChatModel } from "@langchain/core/language_models/chat_models";
import { ChatAnthropic } from "@langchain/anthropic";
import type { ILoggingProvider } from "@shared/types/Logger";
import {
	AIMessage,
	type BaseMessage,
	ChatMessage,
	HumanMessage,
	SystemMessage,
} from "@langchain/core/messages";
import { HaikuModel } from "./models/haiku";
import { AbortError } from "node-fetch";

export class Anthropic implements AIStreamProvider {
	decoder = new TextDecoder();
	chatHistory: BaseMessage[] = [];
	chatModel: AnthropicModel | undefined;
	codeModel: AnthropicModel | undefined;

	constructor(
		private readonly settings: Settings["providerSettings"]["Anthropic"],
		private readonly interactionSettings: InteractionSettings,
		private readonly loggingProvider: ILoggingProvider,
	) {
		if (!settings) {
			throw new Error("Unable to load Anthropic settings.");
		}

		if (!this.settings?.apiKey.trim()) {
			throw new Error("Anthropic API key is required.");
		}

		this.chatModel = this.getChatModel(this.settings.chatModel);
		this.codeModel = this.getCodeModel(this.settings.codeModel);
	}

	addMessageToHistory(input: string): void {
		if (!this.chatHistory) {
			this.chatHistory = [];
		}

		this.chatHistory.push(new AIMessage(input));
	}

	async validateSettings(): Promise<boolean> {
		const isChatModelValid =
			this.settings?.chatModel?.startsWith("claude") || false;
		const isCodeModelValid =
			this.settings?.codeModel?.startsWith("claude") || false;
		return isChatModelValid && isCodeModelValid;
	}

	getModel(params?: ModelParams): BaseChatModel {
		return new ChatAnthropic({
			apiKey: this.settings?.apiKey,
			anthropicApiKey: this.settings?.apiKey,
			model: params?.model ?? this.settings?.chatModel,
			temperature: 0,
			maxTokens: this.interactionSettings?.chatMaxTokens,
			thinking: this.settings?.enableReasoning
				? {
						budget_tokens: 2048,
						type: "enabled",
					}
				: undefined,
		});
	}

	getLightweightModel(params?: ModelParams): BaseChatModel {
		return new ChatAnthropic({
			apiKey: this.settings?.apiKey,
			anthropicApiKey: this.settings?.apiKey,
			model: "claude-3-5-haiku-latest",
			temperature: 0,
			maxTokens: this.interactionSettings?.chatMaxTokens,
			...params,
		});
	}

	getReasoningModel(params?: ModelParams): BaseChatModel {
		return new ChatAnthropic({
			apiKey: this.settings?.apiKey,
			anthropicApiKey: this.settings?.apiKey,
			model: "claude-3-7-sonnet-latest",
			temperature: 0,
			maxTokens: this.interactionSettings?.chatMaxTokens,
			verbose: params?.verbose,
			thinking: this.settings?.enableReasoning
				? {
						budget_tokens: 2048,
						type: "enabled",
					}
				: undefined,
		});
	}

	private getCodeModel(codeModel: string): AnthropicModel | undefined {
		switch (true) {
			case codeModel.includes("sonnet"):
				return new SonnetModel();
			case codeModel.includes("haiku"):
				return new HaikuModel();
			default:
				throw new Error(
					"Invalid code model name, currently code supports Claude 3 model(s).",
				);
		}
	}

	private getChatModel(chatModel: string): AnthropicModel | undefined {
		switch (true) {
			case chatModel.includes("sonnet"):
				return new SonnetModel();
			case chatModel.includes("haiku"):
				return new HaikuModel();
			default:
				throw new Error(
					"Invalid chat model name, currently chat supports Claude 3 model(s).",
				);
		}
	}

	public async codeComplete(
		beginning: string,
		ending: string,
		signal: AbortSignal,
		additionalContext?: string,
		recentClipboard?: string,
	): Promise<string> {
		try {
			const response = await this.getModel({
				temperature: 0.2,
				model: this.settings?.codeModel,
			}).invoke(
				[
					new SystemMessage({
						content: this.codeModel!.CodeCompletionPrompt.replace(
							"{context}",
							`The following are some of the types available in their file. 
	Use these types while considering how to complete the code provided. 
	Do not repeat or use these types in your answer.
	
	${additionalContext || ""}
	
	-----
	
	${
		recentClipboard
			? `The user recently copied these items to their clipboard, use them if they are relevant to the completion:
	
	${recentClipboard}
	
	-----`
			: ""
	}`,
						),
					}),
					new HumanMessage({
						content: `${beginning}[FILL IN THE MIDDLE]${ending}`,
					}),
				],
				{ signal },
			);

			return response.content.toString();
		} catch (e) {
			if (e instanceof Error) {
				this.loggingProvider.logError(
					`Code Complete failed: ${e.message}`,
					!e.message.includes("AbortError"),
				);
			}
		}

		return "";
	}

	public async *chat(prompt: string, ragContent: string, signal: AbortSignal) {
		const systemPrompt = this.chatModel!.ChatPrompt;

		const messages: BaseMessage[] = [new HumanMessage(systemPrompt)];

		if (this.chatHistory.length > 0) {
			//avoid the first message with the system prompt
			messages.push(...this.chatHistory.slice(1));
		} else {
			messages.push(new AIMessage("Happy to help!"));
			this.chatHistory.push(...messages);
		}

		const input = ragContent
			? `Here is some additional information that may help you generate a more accurate response.
    Please determine if this information is relevant and can be used to supplement your response: 
    
    ${ragContent}
    
    ------
    
    ${prompt}`
			: prompt;

		const userMsg = new HumanMessage(input);

		messages.push(userMsg);
		this.chatHistory.push(userMsg);

		truncateChatHistory(6, this.chatHistory);

		let completeMessage = "";
		try {
			const stream = await this.getModel({ temperature: 0.4 }).stream(
				messages,
				{ signal },
			)!;
			for await (const chunk of stream) {
				const result = chunk.content.toString();
				completeMessage += result;
				yield result;
			}

			this.chatHistory.push(
				new AIMessage(completeMessage || "Ignore this message."),
			);
		} catch (e) {
			if (e instanceof AbortError) {
				this.chatHistory.push(
					new ChatMessage({
						role: "assistant",
						content:
							completeMessage ||
							"The user has decided they weren't interested in the response",
					}),
				);
			}

			if (e instanceof Error) {
				this.loggingProvider.logError(
					`Chat failed: ${e.message}`,
					!e.message.includes("AbortError"),
				);
			}
		}
	}

	public clearChatHistory(): void {
		this.chatHistory = [];
	}

	public async genCodeDocs(
		prompt: string,
		ragContent: string,
		signal: AbortSignal,
	): Promise<string> {
		if (!this.chatModel?.genDocPrompt) return "";

		const startTime = new Date().getTime();
		const genDocPrompt = `Generate documentation for the following code:\n${prompt}`;

		let systemPrompt = this.chatModel?.genDocPrompt;

		if (ragContent) {
			systemPrompt += ragContent;
		}

		systemPrompt += `\n\n${genDocPrompt}`;
		systemPrompt = systemPrompt.replace(/\t/, "");

		try {
			const response = await this.getModel({ temperature: 0.4 }).invoke(
				systemPrompt,
				{ signal },
			)!;
			return response.content.toString();
		} catch (e) {
			if (e instanceof Error) {
				this.loggingProvider.logError(
					`GenCodeDocs failed: ${e.message}`,
					!e.message.includes("AbortError"),
				);
			}
		}

		return "";
	}

	public async codeCompleteStream(
		beginning: string,
		ending: string,
		signal: AbortSignal,
		additionalContext?: string,
		recentClipboard?: string,
	): Promise<string> {
		return this.codeComplete(
			beginning,
			ending,
			signal,
			additionalContext,
			recentClipboard,
		);
	}

	public async refactor(
		prompt: string,
		ragContent: string,
		signal: AbortSignal,
	): Promise<string> {
		if (!this.chatModel?.refactorPrompt) return "";

		let systemPrompt = this.chatModel?.refactorPrompt;

		if (ragContent) {
			systemPrompt += `\n${ragContent}`;
		}

		systemPrompt += `\n\n${prompt}`;

		try {
			const response = await this.getModel({ temperature: 0.4 }).invoke(
				systemPrompt,
				{ signal },
			)!;
			return response.content.toString();
		} catch (e) {
			if (e instanceof Error) {
				this.loggingProvider.logError(
					`Refactor failed: ${e.message}`,
					!e.message.includes("AbortError"),
				);
			}
		}

		return "";
	}
}
