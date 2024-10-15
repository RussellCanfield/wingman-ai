import { asyncIterator } from "../asyncIterator";
import { AIStreamProvider } from "../base";
import { InteractionSettings, Settings } from "@shared/types/Settings";
import { ClaudeModel } from "./models/claude";
import { AnthropicRequest } from "./types/ClaudeRequest";
import {
	AnthropicResponse,
	AnthropicResponseStreamContent,
	AnthropicResponseStreamDelta,
	AnthropicStreamResponse,
} from "./types/ClaudeResponse";
import { AnthropicModel } from "@shared/types/Models";
import { truncateChatHistory } from "../utils/contentWindow";
import { BaseChatModel } from "@langchain/core/language_models/chat_models";
import { ChatAnthropic } from "@langchain/anthropic";
import { ILoggingProvider } from "@shared/types/Logger";
import { AIMessage, BaseMessage, HumanMessage } from "@langchain/core/messages";

export class Anthropic implements AIStreamProvider {
	decoder = new TextDecoder();
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
			throw new Error("Unable to load Anthropic settings.");
		}

		if (!this.settings?.apiKey.trim()) {
			throw new Error("Anthropic API key is required.");
		}

		this.chatModel = this.getChatModel(this.settings.chatModel);
		this.codeModel = this.getCodeModel(this.settings.codeModel);

		this.baseModel = new ChatAnthropic({
			apiKey: this.settings.apiKey,
			anthropicApiKey: this.settings.apiKey,
			model: this.settings.chatModel,
			temperature: 0, //Required for tool calling.
			maxTokens: interactionSettings.chatMaxTokens,
		});

		this.rerankModel = new ChatAnthropic({
			apiKey: this.settings.apiKey,
			anthropicApiKey: this.settings.apiKey,
			model: "claude-3-haiku-20240307",
			temperature: 0, //Required for tool calling.
			maxTokens: 4096,
		});
	}

	async validateSettings(): Promise<boolean> {
		const isChatModelValid =
			this.settings?.chatModel?.startsWith("claude") || false;
		const isCodeModelValid =
			this.settings?.codeModel?.startsWith("claude") || false;
		return isChatModelValid && isCodeModelValid;
	}

	getModel(): BaseChatModel {
		return this.baseModel!;
	}

	getRerankModel(): BaseChatModel {
		return this.rerankModel!;
	}

	invoke(prompt: string) {
		return this.baseModel!.invoke(prompt);
	}

	private getCodeModel(codeModel: string): AnthropicModel | undefined {
		switch (true) {
			case codeModel.startsWith("claude"):
				return new ClaudeModel();
			default:
				throw new Error(
					"Invalid code model name, currently code supports Claude 3 model(s)."
				);
		}
	}

	private getChatModel(chatModel: string): AnthropicModel | undefined {
		switch (true) {
			case chatModel.startsWith("claude"):
				return new ClaudeModel();
			default:
				throw new Error(
					"Invalid chat model name, currently chat supports Claude 3 model(s)."
				);
		}
	}

	private async fetchModelResponse(
		payload: AnthropicRequest,
		signal: AbortSignal
	) {
		// Create a combined signal that is aborted when either the provided signal is aborted
		// or the timeout is reached.
		const timeoutSignal = AbortSignal.timeout(15000); // Timeout after 5000ms
		const controller = new AbortController();

		const abortHandler = () => {
			controller.abort();
		};

		signal.addEventListener("abort", abortHandler);
		timeoutSignal.addEventListener("abort", abortHandler);

		if (signal.aborted || timeoutSignal.aborted) {
			return undefined;
		}

		try {
			return fetch(new URL(`${this.settings?.baseUrl}/messages`), {
				method: "POST",
				body: JSON.stringify(payload),
				headers: {
					"Content-Type": "application/json",
					"x-api-key": this.settings?.apiKey!,
					"anthropic-version": "2023-06-01",
				},
				signal: controller.signal,
			});
		} finally {
			// Cleanup
			signal.removeEventListener("abort", abortHandler);
			timeoutSignal.removeEventListener("abort", abortHandler);
		}
	}

	async *generate(payload: AnthropicRequest, signal: AbortSignal) {
		const startTime = new Date().getTime();
		let response: Response | undefined;

		try {
			response = await this.fetchModelResponse(payload, signal);
		} catch (error) {
			return;
			`Anthropic chat request with model: ${payload.model} failed with the following error: ${error}`;
		}

		if (!response?.ok) {
			return `Anthropic - Chat failed with the following status code: ${response?.status}`;
		}

		if (!response?.body) {
			return "";
		}

		const endTime = new Date().getTime();
		const executionTime = (endTime - startTime) / 1000;

		this.loggingProvider.logInfo(
			`Chat Time To First Token execution time: ${executionTime} ms`
		);

		let currentMessage = "";
		for await (const chunk of asyncIterator(response.body)) {
			if (signal.aborted) {
				return "";
			}

			const decodedValue = this.decoder.decode(chunk);

			currentMessage += decodedValue;

			const eventEndIndex = currentMessage.indexOf("\n\n");
			if (eventEndIndex !== -1) {
				// Extract the event data
				const eventData = currentMessage.substring(0, eventEndIndex);

				// Remove the event data from currentMessage
				currentMessage = currentMessage.substring(eventEndIndex + 2);

				// Remove the "data: " prefix and parse the JSON
				const blocks = eventData.split("data: ");

				for (const block of blocks) {
					if (!block || !block.startsWith("{")) {
						continue;
					}

					const jsonStr = block.replace(/\n/g, "");
					const parsedData = JSON.parse(
						jsonStr
					) as AnthropicStreamResponse;

					switch (parsedData.type) {
						case "content_block_start":
							const blockStart =
								parsedData as unknown as AnthropicResponseStreamContent;
							yield blockStart.content_block.text;
							break;
						case "content_block_delta":
							const blockDelta =
								parsedData as unknown as AnthropicResponseStreamDelta;
							yield blockDelta.delta.text;
							break;
						default:
							// Handle unknown event type
							break;
					}
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

		const codeRequestOptions: AnthropicRequest = {
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

${
	recentClipboard
		? `The user recently copied these items to their clipboard, use them if they are relevant to the completion:
  
${recentClipboard}

-----`
		: ""
}

${prompt}`,
				},
			],
			temperature: 0.2,
			top_p: 0.3,
			top_k: 40,
			max_tokens:
				this.interactionSettings?.codeMaxTokens === -1
					? 8192
					: this.interactionSettings?.codeMaxTokens || 8192,
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
			return `Anthropic - code completion request with model ${this.settings?.codeModel} failed with the following error: ${error}`;
		}

		const endTime = new Date().getTime();
		const executionTime = (endTime - startTime) / 1000;

		this.loggingProvider.logInfo(
			`Code Complete Time To First Token execution time: ${executionTime} ms`
		);

		if (!response?.ok && !failedDueToAbort) {
			const responseBody = await response?.text();
			const msg = `Anthropic - Code Completion failed with the following status code: ${response?.status}, body: ${responseBody}`;
			this.loggingProvider.logError(msg);
			return msg;
		}

		if (!response?.body) {
			return "";
		}

		const AnthropicResponse = (await response.json()) as AnthropicResponse;
		return AnthropicResponse.content[0].text;
	}

	public async *chat(
		prompt: string,
		ragContent: string,
		signal: AbortSignal
	) {
		let systemPrompt = this.chatModel!.ChatPrompt;

		const messages: BaseMessage[] = [new HumanMessage(systemPrompt)];

		if (this.chatHistory.length > 0) {
			//avoid the first message with the system prompt
			messages.push(...this.chatHistory.slice(1));
		} else {
			messages.push(new AIMessage("Happy to help!"));
			this.chatHistory.push(...messages);
		}

		const userMsg = new HumanMessage(`${
			ragContent
				? `Here's some additional information that may help you generate a more accurate response.
Please determine if this information is relevant and can be used to supplement your response: 

${ragContent}`
				: ""
		}

------

Here is the user's question which may or may not be related:

${prompt}`);

		messages.push(userMsg);
		this.chatHistory.push(userMsg);

		truncateChatHistory(6, this.chatHistory);

		const stream = await this.baseModel?.stream(messages, { signal })!;

		let completeMessage = "";
		for await (const chunk of stream) {
			const result = chunk.content.toString();
			completeMessage += result;
			yield result;
		}

		this.chatHistory.push(
			new AIMessage(
				completeMessage ||
					"The user has decided they weren't interested in the response"
			)
		);
	}

	public clearChatHistory(): void {
		this.chatHistory = [];
	}

	public async genCodeDocs(
		prompt: string,
		ragContent: string,
		signal: AbortSignal
	): Promise<string> {
		if (!this.chatModel?.genDocPrompt) return "";

		const startTime = new Date().getTime();
		const genDocPrompt =
			"Generate documentation for the following code:\n" + prompt;

		let systemPrompt = this.chatModel?.genDocPrompt;

		if (ragContent) {
			systemPrompt += ragContent;
		}

		systemPrompt += `\n\n${genDocPrompt}`;
		systemPrompt = systemPrompt.replace(/\t/, "");

		const genDocsPayload: AnthropicRequest = {
			model: this.settings?.chatModel!,
			messages: [
				{
					role: "user",
					content: systemPrompt,
				},
			],
			temperature: 0.4,
			top_p: 0.3,
			max_tokens: this.interactionSettings?.chatMaxTokens || 4096,
		};

		let response: Response | undefined;
		try {
			response = await this.fetchModelResponse(genDocsPayload, signal);
		} catch (error) {
			return `Anthropic - Gen Docs request with model ${this.settings?.codeModel} failed with the following error: ${error}`;
		}

		const endTime = new Date().getTime();
		const executionTime = (endTime - startTime) / 1000;

		this.loggingProvider.logInfo(
			`GenDocs Time To First Token execution time: ${executionTime} ms`
		);

		if (!response?.ok) {
			return `Anthropic - Gen Docs failed with the following status code: ${response?.status}`;
		}

		if (!response?.body) {
			return "";
		}

		const AnthropicResponse = (await response.json()) as AnthropicResponse;
		return AnthropicResponse.content[0].text;
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

		const refactorPayload: AnthropicRequest = {
			model: this.settings?.chatModel!,
			messages: [
				{
					role: "user",
					content: systemPrompt,
				},
			],
			temperature: 0.4,
			top_p: 0.3,
			top_k: 40,
			max_tokens: this.interactionSettings?.chatMaxTokens || 4096,
		};

		let response: Response | undefined;
		try {
			response = await this.fetchModelResponse(refactorPayload, signal);
		} catch (error) {
			return `Anthropic - Refactor request with model ${this.settings?.codeModel} failed with the following error: ${error}`;
		}

		const endTime = new Date().getTime();
		const executionTime = (endTime - startTime) / 1000;

		this.loggingProvider.logInfo(
			`Refactor Time To First Token execution time: ${executionTime} ms`
		);

		if (!response?.ok) {
			return `Anthropic - Refactor failed with the following status code: ${response?.status}`;
		}

		if (!response?.body) {
			return "";
		}

		const AnthropicResponse = (await response.json()) as AnthropicResponse;
		return AnthropicResponse.content[0].text;
	}
}
