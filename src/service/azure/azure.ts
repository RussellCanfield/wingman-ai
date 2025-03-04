import type { InteractionSettings, Settings } from "@shared/types/Settings";
import type { AIStreamProvider, ModelParams } from "../base";
import type { ILoggingProvider } from "@shared/types/Logger";
import type { AzureAIModel } from "@shared/types/Models";
import type { BaseChatModel } from "@langchain/core/language_models/chat_models";
import {
	AIMessage,
	type BaseMessage,
	type BaseMessageChunk,
	HumanMessage,
	SystemMessage,
} from "@langchain/core/messages";
import { AzureChatOpenAI } from "@langchain/openai";
import { GPTModel } from "../openai/models/gptmodel";
import { truncateChatHistory } from "../utils/contentWindow";

const reasoningModels = ["o3-mini"];

export class AzureAI implements AIStreamProvider {
	chatHistory: BaseMessage[] = [];
	chatModel: AzureAIModel | undefined;
	codeModel: AzureAIModel | undefined;

	constructor(
		private readonly settings: Settings["providerSettings"]["AzureAI"],
		private readonly interactionSettings: InteractionSettings,
		private readonly loggingProvider: ILoggingProvider,
	) {
		if (!settings) {
			throw new Error("Unable to load AzureAI settings.");
		}

		if (!this.settings?.apiKey.trim()) {
			throw new Error("AzureAI API key is required.");
		}

		this.chatModel = this.getChatModel(this.settings.chatModel);
		this.codeModel = this.getCodeModel(this.settings.codeModel);
	}

	getModel(params?: ModelParams): BaseChatModel {
		const targetModel = params?.model ?? this.settings?.chatModel;
		const isReasoningModel = reasoningModels.some((reasoningModel) =>
			targetModel?.startsWith(reasoningModel),
		);

		return new AzureChatOpenAI({
			apiKey: this.settings?.apiKey,
			azureOpenAIApiKey: this.settings?.apiKey,
			azureOpenAIApiInstanceName: this.settings?.instanceName,
			model: this.settings?.chatModel,
			azureOpenAIApiDeploymentName: this.settings?.chatModel,
			openAIApiVersion: this.settings?.apiVersion,
			deploymentName: this.settings?.chatModel,
			reasoningEffort: isReasoningModel ? "medium" : undefined,
			...(params ?? {}),
		});
	}

	addMessageToHistory(input: string): void {
		if (!this.chatHistory) {
			this.chatHistory = [];
		}

		this.chatHistory.push(new AIMessage(input));
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
		return Promise.resolve(
			isChatModelValid &&
				isCodeModelValid &&
				!!this.settings?.instanceName &&
				!!this.settings?.apiVersion,
		);
	}

	private getCodeModel(codeModel: string): AzureAIModel | undefined {
		switch (true) {
			case codeModel.startsWith("gpt-4") || codeModel.startsWith("o"):
				return new GPTModel();
		}
	}

	private getChatModel(chatModel: string): AzureAIModel | undefined {
		switch (true) {
			case chatModel.startsWith("gpt-4") || chatModel.startsWith("o"):
				return new GPTModel();
		}
	}

	codeCompleteStream(
		beginning: string,
		ending: string,
		signal: AbortSignal,
		additionalContext?: string,
		recentClipboard?: string,
	): Promise<string> {
		// TODO - make this stream
		return this.codeComplete(
			beginning,
			ending,
			signal,
			additionalContext,
			recentClipboard,
		);
	}

	clearChatHistory(): void {
		this.chatHistory = [];
	}

	async codeComplete(
		beginning: string,
		ending: string,
		signal: AbortSignal,
		additionalContext?: string,
		recentClipboard?: string,
	): Promise<string> {
		const startTime = new Date().getTime();

		const prompt = this.codeModel!.CodeCompletionPrompt.replace(
			"{beginning}",
			beginning,
		).replace("{ending}", ending);

		let response: BaseMessageChunk | undefined;
		try {
			response = await this.getModel({
				temperature: 0.2,
				model: this.settings?.codeModel,
			})!.invoke(
				[
					new HumanMessage({
						content: prompt.replace(
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
				],
				{
					signal,
				},
			);
		} catch (error) {
			if (error instanceof Error) {
				this.loggingProvider.logError(`Code Complete failed: ${error.message}`);
			}
			return "";
		}

		const endTime = new Date().getTime();
		const executionTime = (endTime - startTime) / 1000;

		this.loggingProvider.logInfo(
			`Code Complete To First Token execution time: ${executionTime} ms`,
		);

		return response.content.toString();
	}

	public async *chat(prompt: string, ragContent: string, signal: AbortSignal) {
		const messages: BaseMessage[] = [
			new SystemMessage(this.chatModel!.ChatPrompt),
		];

		if (this.chatHistory.length > 0) {
			messages.push(...this.chatHistory);
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

		try {
			const stream = await this.getModel()?.stream(messages, { signal })!;

			let completeMessage = "";
			for await (const chunk of stream) {
				const result = chunk.content.toString();
				completeMessage += result;
				yield result;
			}

			this.chatHistory.push(
				new AIMessage(completeMessage || "Ignore this message."),
			);
		} catch (e) {
			if (e instanceof Error) {
				this.loggingProvider.logError(
					`Chat failed: ${e.message}`,
					!e.message.includes("AbortError"),
				);
			}
		}

		yield "";
	}

	async genCodeDocs(
		prompt: string,
		ragContent: string,
		signal: AbortSignal,
	): Promise<string> {
		const startTime = new Date().getTime();
		const genDocPrompt = `Generate documentation for the following code:\n${prompt}`;

		let systemPrompt = this.chatModel?.genDocPrompt!;

		if (ragContent) {
			systemPrompt += ragContent;
		}

		systemPrompt += `\n\n${genDocPrompt}`;

		let response: BaseMessageChunk | undefined;
		try {
			response = await this.getModel({
				temperature: 0.2,
			})?.invoke([new HumanMessage(systemPrompt)], { signal });
		} catch (error) {
			if (error instanceof Error) {
				this.loggingProvider.logError(`GenDocs failed with ${error.message}`);
			}
			return `AzureAI - Gen Docs request with model ${this.settings?.codeModel} failed with the following error: ${error}`;
		}

		const endTime = new Date().getTime();
		const executionTime = (endTime - startTime) / 1000;

		this.loggingProvider.logInfo(
			`GenDocs Time To First Token execution time: ${executionTime} ms`,
		);

		return response?.content.toString()!;
	}

	async refactor(
		prompt: string,
		ragContent: string,
		signal: AbortSignal,
	): Promise<string> {
		const startTime = new Date().getTime();

		let systemPrompt = this.chatModel?.refactorPrompt;

		if (ragContent) {
			systemPrompt += ragContent;
		}

		systemPrompt += `\n\n${prompt}`;

		let response: BaseMessageChunk | undefined;
		try {
			response = await this.getModel({
				temperature: 0.4,
			}).invoke(String(systemPrompt), {
				signal,
			});
		} catch (error) {
			return `AzureAI - Refactor request with model ${this.settings?.codeModel} failed with the following error: ${error}`;
		}

		const endTime = new Date().getTime();
		const executionTime = (endTime - startTime) / 1000;

		this.loggingProvider.logInfo(
			`Refactor Time To First Token execution time: ${executionTime} ms`,
		);

		return response.content.toString();
	}
}
