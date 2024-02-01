import * as vscode from "vscode";
import { asyncIterator } from "../asyncIterator";
import { AIProvider, GetInteractionSettings } from "../base";
import {
	InteractionSettings,
	Settings,
	defaultMaxTokens,
} from "../../types/Settings";
import { loggingProvider } from "../../providers/loggingProvider";
import { eventEmitter } from "../../events/eventEmitter";
import { GPT4Turbo } from "./models/gpt4-turbo";
import { OpenAIMessages, OpenAIRequest } from "./types/OpenAIRequest";
import { OpenAIResponse, OpenAIStreamResponse } from "./types/OpenAIResponse";
import { OpenAIModel } from "../../types/Models";

export class OpenAI implements AIProvider {
	decoder = new TextDecoder();
	settings: Settings["openai"];
	chatHistory: OpenAIMessages[] = [];
	chatModel: OpenAIModel | undefined;
	codeModel: OpenAIModel | undefined;
	interactionSettings: InteractionSettings | undefined;

	constructor() {
		const config = vscode.workspace.getConfiguration("Wingman");

		const openaiConfig = config.get<Settings["openai"]>("OpenAI");

		loggingProvider.logInfo(
			`OpenAI settings loaded: ${JSON.stringify(openaiConfig)}`
		);

		if (!openaiConfig) {
			this.handleError("Unable to load OpenAI settings.");
			return;
		}

		this.settings = openaiConfig;

		this.chatModel = this.getChatModel(this.settings.chatModel);
		this.codeModel = this.getCodeModel(this.settings.codeModel);

		this.interactionSettings = GetInteractionSettings();
	}

	private handleError(message: string) {
		vscode.window.showErrorMessage(message);
		loggingProvider.logError(message);
		eventEmitter._onFatalError.fire();
		throw new Error(message);
	}

	private getCodeModel(codeModel: string): OpenAIModel | undefined {
		switch (true) {
			case codeModel.startsWith("gpt-4"):
				return new GPT4Turbo();
			default:
				this.handleError(
					"Invalid code model name, currently code supports the GPT-4 Turbo and GPT-4 model(s)."
				);
		}
	}

	private getChatModel(chatModel: string): OpenAIModel | undefined {
		switch (true) {
			case chatModel.startsWith("gpt-4"):
				return new GPT4Turbo();
			default:
				this.handleError(
					"Invalid chat model name, currently chat supports the GPT-4 Turbo and GPT-4 model(s)."
				);
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
			loggingProvider.logError(
				`OpenAI chat request with model: ${payload.model} failed with the following error: ${error}`
			);
		}

		if (!response?.body) {
			return "";
		}

		const endTime = new Date().getTime();
		const executionTime = (endTime - startTime) / 1000;

		loggingProvider.logInfo(
			`OpenAI - Chat Time To First Token execution time: ${executionTime} seconds`
		);

		let currentMessage = "";
		for await (const chunk of asyncIterator(response.body)) {
			if (signal.aborted) {
				return "";
			}

			const decodedValue = this.decoder.decode(chunk).trim();

			//TODO: Refactor for cleaner handling between partial chunks in streaming responses.
			if (
				decodedValue.startsWith("\ndata: ") ||
				decodedValue.startsWith("data: ")
			) {
				if (
					currentMessage.endsWith("\n") ||
					currentMessage.indexOf("\n\ndata: ") > -1
				) {
					const sanitizedChunk = currentMessage
						.replace(/^(\n)?data: /g, "")
						.replace(/\n+$/, "");

					const splitChunks = sanitizedChunk.split("\n\ndata: ");

					for (const split of splitChunks) {
						yield JSON.parse(split) as OpenAIStreamResponse;
					}
				}

				currentMessage = decodedValue;
			} else {
				currentMessage += decodedValue;
			}
		}
	}

	public async codeComplete(
		beginning: string,
		ending: string,
		signal: AbortSignal
	): Promise<string> {
		const startTime = new Date().getTime();

		const codeRequestOptions: OpenAIRequest = {
			model: this.settings?.codeModel!,
			messages: [
				{
					role: "user",
					content: this.codeModel!.CodeCompletionPrompt.replace(
						"{beginning}",
						beginning
					).replace("{ending}", ending),
				},
			],
			temperature: 0.4,
			top_p: 0.3,
		};

		loggingProvider.logInfo(
			`OpenAI - Code Completion submitting request with body: ${JSON.stringify(
				codeRequestOptions
			)}`
		);

		let response: Response | undefined;

		try {
			response = await this.fetchModelResponse(
				codeRequestOptions,
				signal
			);
		} catch (error) {
			loggingProvider.logError(
				`OpenAI - code completion request with model ${this.settings?.codeModel} failed with the following error: ${error}`
			);
		}

		const endTime = new Date().getTime();
		const executionTime = (endTime - startTime) / 1000;

		loggingProvider.logInfo(
			`OpenAI - Code Completion execution time: ${executionTime} seconds`
		);

		if (!response?.body) {
			return "";
		}

		const ollamaResponse = (await response.json()) as OpenAIResponse;
		return ollamaResponse.choices[0].message.content;
	}

	public clearChatHistory(): void {
		this.chatHistory = [];
	}

	public async *chat(
		prompt: string,
		ragContent: string,
		signal: AbortSignal
	) {
		let systemPrompt = this.chatModel!.ChatPrompt;

		if (ragContent) {
			systemPrompt += `Here's some additional information that may help you generate a more accurate response.
            Please determine if this information is relevant and can be used to supplement your response: 
            ${ragContent}
			---------------`;
		}

		systemPrompt += `\n${prompt}`;

		systemPrompt = systemPrompt.replace(/\t/, "");

		const chatPayload: OpenAIRequest = {
			model: this.settings?.chatModel!,
			messages: [
				...this.chatHistory,
				{
					role: "user",
					content: systemPrompt,
				},
			],
			stream: true,
			temperature: 0.8,
		};

		loggingProvider.logInfo(
			`OpenAI - Chat submitting request with body: ${JSON.stringify(
				chatPayload
			)}`
		);

		this.clearChatHistory();

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

		this.chatHistory = this.chatHistory.concat({
			role: "assistant",
			content: completeMessage,
		});
	}
}
