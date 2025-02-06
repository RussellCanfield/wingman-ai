import { InteractionSettings, Settings } from "@shared/types/Settings";
import { GPTModel } from "./models/gptmodel";
import { OpenAIModel } from "@shared/types/Models";
import { truncateChatHistory } from "../utils/contentWindow";
import { BaseChatModel } from "@langchain/core/language_models/chat_models";
import { ChatOpenAI } from "@langchain/openai";
import { AIStreamProvider, isOClassModel, ModelParams } from "../base";
import { ILoggingProvider } from "@shared/types/Logger";
import { BaseMessage, ChatMessage, SystemMessage } from "@langchain/core/messages";
import { AbortError } from "node-fetch";

export class OpenAI implements AIStreamProvider {
	decoder = new TextDecoder();
	chatHistory: BaseMessage[] = [];
	chatModel: OpenAIModel | undefined;
	codeModel: OpenAIModel | undefined;

	constructor(
		private readonly settings: Settings["providerSettings"]["OpenAI"],
		private readonly interactionSettings: InteractionSettings,
		private readonly loggingProvider: ILoggingProvider
	) {
		if (!settings) {
			throw new Error("Unable to load OpenAI settings.");
		}

		if (!this.settings?.apiKey.trim()) {
			throw new Error("OpenAI API key is required.");
		}

		this.chatModel = this.getChatModel(this.settings.chatModel);
		this.codeModel = this.getCodeModel(this.settings.codeModel);
	}

	addMessageToHistory(input: string): void {
		if (!this.chatHistory) {
			this.chatHistory = [];
		}

		this.chatHistory.push(new ChatMessage({
			role: "assistant",
			content: input
		}));
	}

	getModel(params?: ModelParams): BaseChatModel {
		if (isOClassModel(this.settings?.chatModel) ||
			isOClassModel(params?.model)) {
			params = {
				...(params ?? {}),
				temperature: undefined
			};
		}

		return new ChatOpenAI({
			apiKey: this.settings?.apiKey,
			model: params?.model ?? this.settings?.chatModel,
			openAIApiKey: this.settings?.apiKey,
			...(params ?? {})
		});
	}

	getLightweightModel(params?: ModelParams): BaseChatModel {
		if (isOClassModel(this.settings?.chatModel) ||
			isOClassModel(params?.model)) {
			params = {
				...(params ?? {}),
				temperature: undefined
			};
		}

		return new ChatOpenAI({
			apiKey: this.settings?.apiKey,
			model: "gpt-4o-mini",
			openAIApiKey: this.settings?.apiKey,
			...(params ?? {})
		});
	}

	getReasoningModel(params?: ModelParams): BaseChatModel {
		if (isOClassModel(this.settings?.chatModel) ||
			isOClassModel(params?.model)) {
			params = {
				...(params ?? {}),
				temperature: undefined
			};
		}

		return new ChatOpenAI({
			apiKey: this.settings?.apiKey,
			model: this.settings?.chatModel,
			openAIApiKey: this.settings?.apiKey,
			modelKwargs: this.settings?.chatModel.startsWith("o3") ? { reasoning_effort: "high" } : undefined,
			...(params ?? {})
		});
	}

	validateSettings(): Promise<boolean> {
		const isChatModelValid =
			this.settings?.chatModel?.startsWith("gpt-4") ||
			this.settings?.chatModel?.startsWith("o") ||
			false;
		const isCodeModelValid =
			this.settings?.codeModel?.startsWith("gpt-4") ||
			this.settings?.codeModel?.startsWith("o") ||
			false;
		return Promise.resolve(isChatModelValid && isCodeModelValid);
	}

	private getCodeModel(codeModel: string): OpenAIModel | undefined {
		switch (true) {
			case codeModel.startsWith("gpt-4") || codeModel.startsWith("o"):
				return new GPTModel();
		}
	}

	private getChatModel(chatModel: string): OpenAIModel | undefined {
		switch (true) {
			case chatModel.startsWith("gpt-4") || chatModel.startsWith("o"):
				return new GPTModel();
		}
	}

	public async codeComplete(
		beginning: string,
		ending: string,
		signal: AbortSignal,
		additionalContext?: string,
		recentClipboard?: string
	): Promise<string> {
		const startTime = new Date().getTime();

		const prompt = this.codeModel!.CodeCompletionPrompt.replace(
			"{beginning}",
			beginning
		)
			.replace("{ending}", ending)
			.replace(
				"{context}",
				`The following are some of the types available in their file. 
Use these types while considering how to complete the code provided. 
Do not repeat or use these types in your answer.

${additionalContext || ""}

-----

${recentClipboard
					? `The user recently copied these items to their clipboard, use them if they are relevant to the completion:

${recentClipboard}

-----`
					: ""
				}`
			);

		try {
			const response = await this.getModel({
				temperature: 0.2,
				model: this.settings?.codeModel
			}).invoke(prompt, { signal });

			return response.content.toString();
		} catch (error) {
			this.loggingProvider.logError(error);
		} finally {
			return "";
		}
	}

	public async codeCompleteStream(
		beginning: string,
		ending: string,
		signal: AbortSignal,
		additionalContext?: string,
		recentClipboard?: string
	): Promise<string> {
		return this.codeComplete(
			beginning,
			ending,
			signal,
			additionalContext,
			recentClipboard
		);
	}

	public clearChatHistory(): void {
		this.chatHistory = [];
	}

	public async *chat(
		prompt: string,
		ragContent: string,
		signal: AbortSignal
	) {
		const messages: BaseMessage[] = [
			new SystemMessage({
				content: [
					{
						type: "text",
						cache_control: { type: "ephemeral" },
						text: this.chatModel!.ChatPrompt,
					},
				],
			})
		]

		if (this.chatHistory.length > 0) {
			messages.push(...this.chatHistory.slice(1));
		} else {
			this.chatHistory.push(...messages);
		}

		const userMsg = new ChatMessage({
			role: "user",
			content: `${ragContent
				? `Here's some additional information that may help you generate a more accurate response.
Do not repeat this information in your response to the user, but use it to help generate a more accurate response.
Please determine if this information is relevant and can be used to supplement your response: 

${ragContent}`
				: ""
				}

------

Here is the user's question which may or may not be related:

${prompt}`,
		});
		messages.push(userMsg);
		this.chatHistory.push(userMsg);

		truncateChatHistory(6, this.chatHistory);

		let completeMessage = "";
		try {
			const stream = await this.getModel().stream(messages, { signal });
			for await (const chunk of stream) {
				if (!chunk?.content) {
					continue;
				}

				completeMessage += chunk.content.toString();
				yield chunk.content.toString();
			}

			this.chatHistory.push(new ChatMessage({
				role: "assistant",
				content: completeMessage
			}));
		} catch (e) {
			if (e instanceof AbortError) {
				this.chatHistory.push(new ChatMessage({
					role: "assistant",
					content:
						completeMessage ||
						"The user has decided they weren't interested in the response",
				}));
			}

			if (e instanceof Error) {
				this.loggingProvider.logError(
					`Chat failed: ${e.message}`,
					!e.message.includes("AbortError")
				);
			}
		}
	}

	public async genCodeDocs(
		prompt: string,
		ragContent: string,
		signal: AbortSignal
	): Promise<string> {
		if (!this.chatModel?.genDocPrompt) {
			return "";
		}

		const genDocPrompt =
			"Generate documentation for the following code:\n" + prompt;

		let systemPrompt = this.chatModel?.genDocPrompt;

		if (ragContent) {
			systemPrompt += ragContent;
		}

		systemPrompt += `\n\n${genDocPrompt}`;
		systemPrompt = systemPrompt.replace(/\t/, "");

		try {
			const response = await this.getModel({
				temperature: 0.2
			}).invoke(systemPrompt, { signal });

			return response.content.toString();
		} catch (error) {
			this.loggingProvider.logError(error);
		} finally {
			return "";
		}
	}

	public async refactor(
		prompt: string,
		ragContent: string,
		signal: AbortSignal
	): Promise<string> {
		if (!this.chatModel?.refactorPrompt) return "";

		let systemPrompt = this.chatModel?.refactorPrompt;

		if (ragContent) {
			systemPrompt += `\n${ragContent}`;
		}

		systemPrompt += `\n\n${prompt}`;

		try {
			const response = await this.getModel({
				temperature: 0.4
			}).invoke(systemPrompt, { signal });

			return response.content.toString();
		} catch (error) {
			this.loggingProvider.logError(error);
		} finally {
			return "";
		}
	}
}
