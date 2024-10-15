import { asyncIterator } from "../asyncIterator";
import { InteractionSettings, Settings } from "@shared/types/Settings";
import { GPTModel } from "./models/gptmodel";
import { OpenAIMessage, OpenAIRequest } from "./types/OpenAIRequest";
import { OpenAIResponse, OpenAIStreamResponse } from "./types/OpenAIResponse";
import { OpenAIModel } from "@shared/types/Models";
import { truncateChatHistory } from "../utils/contentWindow";
import { BaseChatModel } from "@langchain/core/language_models/chat_models";
import { ChatOpenAI } from "@langchain/openai";
import { AIStreamProvider } from "../base";
import { ILoggingProvider } from "@shared/types/Logger";

export class OpenAI implements AIStreamProvider {
	decoder = new TextDecoder();
	chatHistory: OpenAIMessage[] = [];
	chatModel: OpenAIModel | undefined;
	codeModel: OpenAIModel | undefined;
	baseModel: BaseChatModel | undefined;
	rerankModel: BaseChatModel | undefined;

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

		this.baseModel = new ChatOpenAI({
			apiKey: this.settings.apiKey,
			model: this.settings.chatModel,
			openAIApiKey: this.settings.apiKey,
			temperature: 0,
			maxTokens: interactionSettings.chatMaxTokens,
		});

		this.rerankModel = new ChatOpenAI({
			apiKey: this.settings.apiKey,
			model: "gpt-4o-mini",
			openAIApiKey: this.settings.apiKey,
			temperature: 0,
			maxTokens: interactionSettings.chatMaxTokens,
		});
	}

	getModel(): BaseChatModel {
		return this.baseModel!;
	}

	getRerankModel(): BaseChatModel {
		return this.baseModel!;
	}

	invoke(prompt: string) {
		return this.baseModel!.invoke(prompt);
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

	private getCodeModel(codeModel: string): OpenAIModel | undefined {
		switch (true) {
			case codeModel.startsWith("gpt-4") || codeModel.startsWith("o1"):
				return new GPTModel();
		}
	}

	private getChatModel(chatModel: string): OpenAIModel | undefined {
		switch (true) {
			case chatModel.startsWith("gpt-4") || chatModel.startsWith("o1"):
				return new GPTModel();
		}
	}

	private async fetchModelResponse(
		payload: OpenAIRequest,
		signal: AbortSignal
	) {
		if (signal.aborted) {
			return undefined;
		}
		return fetch(new URL(this.settings?.baseUrl!), {
			method: "POST",
			body: JSON.stringify(payload),
			headers: {
				"Content-Type": "application/json",
				Authorization: `Bearer ${this.settings?.apiKey}`,
			},
			signal,
		});
	}

	async *generate(payload: OpenAIRequest, signal: AbortSignal) {
		const startTime = new Date().getTime();
		let response: Response | undefined;

		try {
			response = await this.fetchModelResponse(payload, signal);
		} catch (error) {
			return `OpenAI chat request with model: ${payload.model} failed with the following error: ${error}`;
		}

		if (!response?.ok) {
			return `OpenAI - Chat failed with the following status code: ${response?.status}`;
		}

		if (!response?.body) {
			return "";
		}

		const endTime = new Date().getTime();
		const executionTime = (endTime - startTime) / 1000;

		console.log(
			`Chat Time To First Token execution time: ${executionTime} ms`
		);

		let currentMessage = "";
		for await (const chunk of asyncIterator(response.body)) {
			if (signal.aborted) {
				return "";
			}

			const decodedValue = new TextDecoder().decode(chunk);
			currentMessage += decodedValue;

			let eventEndIndex;
			while ((eventEndIndex = currentMessage.indexOf("\n\n")) !== -1) {
				const eventData = currentMessage.substring(0, eventEndIndex);
				currentMessage = currentMessage.substring(eventEndIndex + 2);

				// Check for special non-JSON messages
				if (eventData.trim() === "data: [DONE]") {
					this.loggingProvider.logInfo(
						"Received DONE signal, handling accordingly."
					);
					// Handle the DONE signal as needed, possibly breaking the loop or signaling completion
					continue; // Or break, if appropriate for your use case
				}

				const jsonStr = eventData.replace(/^data: /, "");
				try {
					const parsedData = JSON.parse(jsonStr);
					yield parsedData as OpenAIStreamResponse;
				} catch (error) {
					console.error("Failed to parse JSON", error);
				}
			}
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
		).replace("{ending}", ending);

		const codeRequestOptions: OpenAIRequest = {
			model: this.settings?.codeModel!,
			messages: [
				{
					role: "user",
					content: `You are an senior software engineer, assit the user with completing their code.
When generating code focus on existing code style, syntax, and structure and follow use this as a guide.

The following are some of the types available in their file. 
Use these types while considering how to complete the code provided. 
Do not repeat or use these types in your answer.

${additionalContext || ""}

-----

The user recently copied these items to their clipboard, use them if they are relevant to the completion:

${recentClipboard || ""}

-----

${prompt}`,
				},
			],
			temperature: 0.2,
			top_p: 0.3,
		};

		let response: Response | undefined;
		let failedDueToAbort = false;

		try {
			response = await this.fetchModelResponse(
				codeRequestOptions,
				signal
			);
		} catch (error) {
			if ((error as Error).name === "AbortError") {
				failedDueToAbort = true;
			}
			return `OpenAI - code completion request with model ${this.settings?.codeModel} failed with the following error: ${error}`;
		}

		const endTime = new Date().getTime();
		const executionTime = (endTime - startTime) / 1000;

		this.loggingProvider.logInfo(
			`Code Time To First Token execution time: ${executionTime} ms`
		);

		if (!response?.ok && !failedDueToAbort) {
			return `OpenAI - Code Completion failed with the following status code: ${response?.status}`;
		}

		if (!response?.body) {
			return "";
		}

		const openAiResponse = (await response.json()) as OpenAIResponse;
		return openAiResponse.choices[0].message.content;
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
		const messages: OpenAIMessage[] = [
			{
				role: "assistant",
				content: this.chatModel!.ChatPrompt,
			},
		];

		if (this.chatHistory.length > 0) {
			messages.push(...this.chatHistory.slice(1));
		} else {
			this.chatHistory.push(...messages);
		}

		const userMsg: OpenAIMessage = {
			role: "user",
			content: `${
				ragContent
					? `Here's some additional information that may help you generate a more accurate response.
Do not repeat this information in your response to the user, but use it to help generate a more accurate response.
Please determine if this information is relevant and can be used to supplement your response: 

${ragContent}`
					: ""
			}

------

Here is the user's question which may or may not be related:

${prompt}`,
		};
		messages.push(userMsg);
		this.chatHistory.push(userMsg);

		const chatPayload: OpenAIRequest = {
			model: this.settings?.chatModel!,
			messages,
			stream: true,
			temperature: 0.8,
			max_tokens: this.interactionSettings?.chatMaxTokens || 4096,
		};

		truncateChatHistory(6, this.chatHistory);

		let completeMessage = "";
		for await (const chunk of this.generate(chatPayload, signal)) {
			if (!chunk?.choices) {
				continue;
			}

			const { content } = chunk.choices[0].delta;
			if (!content) {
				continue;
			}

			completeMessage += content;
			yield content;
		}

		this.chatHistory.push({
			role: "assistant",
			content:
				completeMessage ||
				"The user has decided they weren't interested in the response",
		});
	}

	public async genCodeDocs(
		prompt: string,
		ragContent: string,
		signal: AbortSignal
	): Promise<string> {
		if (!this.chatModel?.genDocPrompt) {
			return "";
		}

		const startTime = new Date().getTime();
		const genDocPrompt =
			"Generate documentation for the following code:\n" + prompt;

		let systemPrompt = this.chatModel?.genDocPrompt;

		if (ragContent) {
			systemPrompt += ragContent;
		}

		systemPrompt += `\n\n${genDocPrompt}`;
		systemPrompt = systemPrompt.replace(/\t/, "");

		const genDocsPayload: OpenAIRequest = {
			model: this.settings?.chatModel!,
			messages: [
				{
					role: "user",
					content: systemPrompt,
				},
			],
			temperature: 0.4,
			top_p: 0.3,
		};

		let response: Response | undefined;
		try {
			response = await this.fetchModelResponse(genDocsPayload, signal);
		} catch (error) {
			return `OpenAI - Gen Docs request with model ${this.settings?.codeModel} failed with the following error: ${error}`;
		}

		const endTime = new Date().getTime();
		const executionTime = (endTime - startTime) / 1000;

		this.loggingProvider.logInfo(
			`CodeDocs Time To First Token execution time: ${executionTime} ms`
		);

		if (!response?.ok) {
			return `OpenAI - Gen Docs failed with the following status code: ${response?.status}`;
		}

		if (!response?.body) {
			return "";
		}

		const openAiResponse = (await response.json()) as OpenAIResponse;
		return openAiResponse.choices[0].message.content;
	}

	public async refactor(
		prompt: string,
		ragContent: string,
		signal: AbortSignal
	): Promise<string> {
		if (!this.chatModel?.refactorPrompt) return "";

		const startTime = new Date().getTime();

		let systemPrompt = this.chatModel?.refactorPrompt;

		if (ragContent) {
			systemPrompt += ragContent;
		}

		systemPrompt += `\n\n${prompt}`;

		const refactorPayload: OpenAIRequest = {
			model: this.settings?.chatModel!,
			messages: [
				{
					role: "user",
					content: systemPrompt,
				},
			],
			temperature: 0.4,
			top_p: 0.3,
		};

		let response: Response | undefined;
		try {
			response = await this.fetchModelResponse(refactorPayload, signal);
		} catch (error) {
			return `OpenAI - Refactor request with model ${this.settings?.codeModel} failed with the following error: ${error}`;
		}

		const endTime = new Date().getTime();
		const executionTime = (endTime - startTime) / 1000;

		this.loggingProvider.logInfo(
			`Refactor Time To First Token execution time: ${executionTime} ms`
		);

		if (!response?.ok) {
			return `OpenAI - Refactor failed with the following status code: ${response?.status}`;
		}

		if (!response?.body) {
			return "";
		}

		const openAiResponse = (await response.json()) as OpenAIResponse;
		return openAiResponse.choices[0].message.content;
	}
}
