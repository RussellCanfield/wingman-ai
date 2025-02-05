import { OllamaAIModel } from "./types";
import { InteractionSettings, Settings } from "@shared/types/Settings";
import { asyncIterator } from "../asyncIterator";
import { AIStreamProvider, ModelParams } from "../base";
import { delay } from "../delay";
import { CodeLlama } from "./models/codellama";
import { CodeQwen } from "./models/codeqwen";
import { Codestral } from "./models/codestral";
import { Deepseek } from "./models/deepseek";
import { Llama3 } from "./models/llama3";
import { Magicoder } from "./models/magicoder";
import { PhindCodeLlama } from "./models/phind-codellama";
import {
	OllamaRequest,
	OllamaResponse,
	OllamaChatMessage,
	OllamaChatRequest,
	OllamaChatResponse,
} from "./types";
import { truncateChatHistory } from "../utils/contentWindow";
import { BaseChatModel } from "@langchain/core/language_models/chat_models";
import { ChatOllama } from "@langchain/ollama";
import { Qwen } from "./models/qwen";
import { ILoggingProvider } from "@shared/types/Logger";
import { Phi } from "./models/phi";

export class Ollama implements AIStreamProvider {
	decoder = new TextDecoder();
	chatHistory: OllamaChatMessage[] = [];
	chatModel: OllamaAIModel | undefined;
	codeModel: OllamaAIModel | undefined;
	interactionSettings: InteractionSettings | undefined;
	baseModel: BaseChatModel | undefined;
	rerankModel: BaseChatModel | undefined;

	constructor(
		private readonly settings: Settings["providerSettings"]["Ollama"],
		interactionSettings: InteractionSettings,
		private readonly loggingProvider: ILoggingProvider
	) {
		if (!settings) {
			throw new Error("Unable to load Ollama settings.");
		}

		this.chatModel = this.getChatModel(this.settings!.chatModel);
		this.codeModel = this.getCodeModel(this.settings!.codeModel);

		this.baseModel = new ChatOllama({
			baseUrl: this.settings!.baseUrl,
			model: this.settings!.chatModel,
			temperature: 0,
			topK: 40,
			topP: 0.4,
			maxRetries: 2,
			streaming: false,
		});

		this.rerankModel = new ChatOllama({
			baseUrl: this.settings!.baseUrl,
			model: this.settings!.chatModel,
			temperature: 0,
			maxRetries: 2,
		});
	}

	addMessageToHistory(input: string): void {
		if (!this.chatHistory) {
			this.chatHistory = [];
		}

		this.chatHistory.push({
			role: "assistant",
			content: input
		});
	}

	getModel(): BaseChatModel {
		return this.baseModel!;
	}

	getLightweightModel(): BaseChatModel {
		return this.rerankModel!;
	}

	getReasoningModel(params?: ModelParams): BaseChatModel {
		return this.baseModel!;
	}

	invoke(prompt: string) {
		return new ChatOllama({
			baseUrl: this.settings!.baseUrl,
			model: this.settings!.chatModel,
			temperature: 0,
			topK: 40,
			topP: 0.4,
			streaming: false,
		}).invoke(prompt);
	}

	async validateSettings(): Promise<boolean> {
		if (
			!(await this.validateModelExists(
				this.settings?.chatModel ?? "unknown"
			))
		) {
			return false;
		}

		if (
			!(await this.validateModelExists(
				this.settings?.codeModel ?? "unknown"
			))
		) {
			return false;
		}

		if (!this.chatModel || !this.codeModel) return false;

		return true;
	}

	private getCodeModel(codeModel: string): OllamaAIModel | undefined {
		switch (true) {
			case codeModel.startsWith("phi4"):
				return new Phi();
			case codeModel.startsWith("qwen"):
				return new Qwen();
			case codeModel.includes("magicoder"):
				return new Magicoder();
			case codeModel.startsWith("codellama"):
				return new CodeLlama();
			case codeModel.startsWith("deepseek"):
				return new Deepseek();
			case codeModel.startsWith("codeqwen"):
				return new CodeQwen();
			case codeModel.startsWith("codestral"):
				return new Codestral();
			default:
				return undefined;
		}
	}

	private getChatModel(chatModel: string): OllamaAIModel | undefined {
		switch (true) {
			case chatModel.startsWith("phi4"):
				return new Phi();
			case chatModel.startsWith("qwen"):
				return new Qwen();
			case chatModel.includes("magicoder"):
				return new Magicoder();
			case chatModel.startsWith("llama3"):
				return new Llama3();
			case chatModel.startsWith("codellama"):
				return new CodeLlama();
			case chatModel.startsWith("deepseek"):
				return new Deepseek();
			case chatModel.startsWith("phind"):
				return new PhindCodeLlama();
			case chatModel.startsWith("codeqwen"):
				return new CodeQwen();
			case chatModel.startsWith("codestral"):
				return new Codestral();
			default:
				return undefined;
		}
	}

	public async validateModelExists(modelName: string): Promise<boolean> {
		try {
			const response = await fetch(
				new URL(
					`${this.settings?.baseUrl}${this.settings?.modelInfoPath}`
				),
				{
					method: "POST",
					body: JSON.stringify({
						name: modelName,
					}),
				}
			);

			if (response.status === 200) {
				return true;
			}
		} catch (error) {
			console.error(error);
		}

		return false;
	}

	private async fetchModelResponse(
		payload: OllamaRequest,
		signal: AbortSignal
	) {
		if (signal.aborted) {
			return undefined;
		}
		return fetch(
			new URL(`${this.settings?.baseUrl}${this.settings?.apiPath}`),
			{
				method: "POST",
				body: JSON.stringify(payload),
				signal,
			}
		);
	}

	private async fetchChatResponse(
		payload: OllamaChatRequest,
		signal: AbortSignal
	) {
		if (signal.aborted) {
			return undefined;
		}
		return await fetch(new URL(`${this.settings?.baseUrl}/api/chat`), {
			method: "POST",
			body: JSON.stringify(payload),
			signal,
		});
	}

	async *generate(payload: OllamaChatRequest, signal: AbortSignal) {
		const startTime = new Date().getTime();
		let response: Response | undefined;

		try {
			response = await this.fetchChatResponse(payload, signal);
		} catch (error) {
			return `Ollama chat request with model: ${payload.model} failed with the following error: ${error}`;
		}

		if (!response?.body) {
			return "";
		}

		const endTime = new Date().getTime();
		const executionTime = (endTime - startTime) / 1000;

		for await (const chunk of asyncIterator(response.body)) {
			if (signal.aborted) {
				return;
			}

			try {
				const jsonString = this.decoder.decode(chunk);
				const message = JSON.parse(jsonString) as OllamaChatResponse;
				if (message.error) {
					throw new Error(message.error);
				}
				yield message;
			} catch (e) {
				console.warn(e);
			}
		}
	}

	private async *generateCode(
		payload: OllamaRequest,
		signal: AbortSignal
	): AsyncGenerator<string> {
		const startTime = Date.now();
		let response: Response | undefined;

		try {
			response = await this.fetchModelResponse(payload, signal);
		} catch (error) {
			this.loggingProvider.logError(
				`Unable to generate code:, ${error instanceof Error
					? error.message
					: JSON.stringify(error)
				}`
			);
			return "";
		}

		if (!response?.body) {
			return "";
		}

		const endTime = Date.now();
		const executionTime = endTime - startTime;

		this.loggingProvider.logInfo(
			`Code Time To First Token execution time: ${executionTime} ms`
		);

		for await (const chunk of asyncIterator(response.body)) {
			if (signal.aborted) {
				return "";
			}
			const jsonString = this.decoder.decode(chunk);
			// we can have more then one ollama response
			const jsonStrings = jsonString
				.replace(/}\n{/gi, "}\u241e{")
				.split("\u241e");
			try {
				let codeLines: string[] = [];
				for (const json of jsonStrings) {
					const result = JSON.parse(json) as OllamaResponse;
					codeLines.push(result.response);
				}
				yield codeLines.join("");
			} catch (e) {
				console.error(e);
				return "";
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
		)
			.replace("{ending}", ending)
			.replace(
				"{context}",
				`The following are all the types available. Use these types while considering how to complete the code provided. Do not repeat or use these types in your answer.

${additionalContext ?? ""}

-----

${recentClipboard
					? `The user recently copied these items to their clipboard, use them if they are relevant to the completion:
  
${recentClipboard}

-----`
					: ""
				}`
			);
		const codeRequestOptions: OllamaRequest = {
			model: this.settings?.codeModel!,
			prompt: prompt,
			stream: false,
			raw: true,
			options: {
				temperature: 0.6,
				num_predict: this.interactionSettings?.codeMaxTokens ?? -1,
				top_k: 30,
				top_p: 0.2,
				repeat_penalty: 1.1,
				stop: [
					"<｜end▁of▁sentence｜>",
					"<｜EOT｜>",
					"\\n",
					"</s>",
					"<|eot_id|>",
				],
			},
		};

		let response: Response | undefined;

		try {
			response = await this.fetchModelResponse(
				codeRequestOptions,
				signal
			);
		} catch (error) {
			console.error(error);
		}

		const endTime = new Date().getTime();
		const executionTime = (endTime - startTime) / 1000;

		this.loggingProvider.logInfo(
			`Code Completion execution time: ${executionTime} seconds`
		);

		if (!response?.body) {
			return "";
		}

		const ollamaResponse = (await response.json()) as OllamaResponse;
		return ollamaResponse.response;
	}

	private codeCompleteRequest = async (
		sentences: string[],
		codeRequestOptions: OllamaRequest,
		signal: AbortSignal,
		status: { done: boolean }
	) => {
		const startTime = new Date().getTime();
		let words: string[] = [];
		for await (const characters of this.generateCode(
			codeRequestOptions,
			signal
		)) {
			if (characters.indexOf("\n") > -1) {
				const splitOnLine = characters.split("\n");
				let x = 0;
				for (; x < splitOnLine.length - 1; x++) {
					words.push(splitOnLine[x]);
					const sentence = words.join("");
					sentences.push(sentence);
					words = [];
				}
				words.push(splitOnLine[x]);
			} else {
				words.push(characters);
			}
		}
		if (words.length) {
			sentences.push(words.join(""));
		}
		status.done = true;
		const endTime = new Date().getTime();
		const executionTime = (endTime - startTime) / 1000;

		this.loggingProvider.logInfo(
			`Ollama - Code stream finished in ${executionTime} seconds with contents: ${JSON.stringify(
				sentences
			)}`
		);
	};

	public async codeCompleteStream(
		beginning: string,
		ending: string,
		signal: AbortSignal,
		additionalContext?: string
	): Promise<string> {
		const prompt = this.codeModel!.CodeCompletionPrompt.replace(
			"{beginning}",
			beginning
		).replace("{ending}", ending);
		const codeRequestOptions: OllamaRequest = {
			model: this.settings?.codeModel!,
			prompt: `The following are all the types available. Use these types while considering how to complete the code provided. Do not repeat or use these types in your answer.

${additionalContext ?? ""}

-----

${prompt}`,
			stream: true,
			raw: true,
			options: {
				temperature: 0.4,
				num_predict: this.interactionSettings?.codeMaxTokens ?? -1,
				top_k: 30,
				top_p: 0.2,
				repeat_penalty: 1.1,
				stop: [
					"<｜end▁of▁sentence｜>",
					"<｜EOT｜>",
					"\\n",
					"<|eot_id|>",
				],
			},
		};

		let sentences: string[] = [];
		let requestStatus = { done: false };
		const abortSignal = new AbortController();
		signal.onabort = () => abortSignal.abort();
		try {
			this.codeCompleteRequest(
				sentences,
				codeRequestOptions,
				abortSignal.signal,
				requestStatus
			);
			const start = Date.now();
			let now = Date.now();
			// lets setup a window to allow for the fastest return time
			while (now - start < 4500) {
				await delay(100);
				if (requestStatus.done) {
					return sentences.join("\n");
				}

				if (now - start > 1000 && sentences.length > 1) {
					abortSignal.abort();
					return sentences.join("\n");
				}
				now = Date.now();
			}
			abortSignal.abort();
			return sentences.join("\n");
		} catch {
			return "";
		}
	}

	public clearChatHistory(): void {
		this.chatHistory = [];
	}

	public async *chat(
		prompt: string,
		ragContent: string,
		signal: AbortSignal
	) {
		const messages: OllamaChatMessage[] = [
			{
				role: "user",
				content: this.chatModel!.ChatPrompt,
			},
		];

		if (this.chatHistory.length > 0) {
			messages.push(...this.chatHistory.slice(1));
		} else {
			this.chatHistory.push(...messages);
		}

		messages.push({
			role: "assistant",
			content: `${ragContent
				? `Here's some additional information that may help you generate a more accurate response.
Please determine if this information is relevant and can be used to supplement your response: 

${ragContent}`
				: ""
				}`,
		});

		messages.push({
			role: "user",
			content: prompt,
		});

		this.chatHistory.push(
			messages[messages.length - 2],
			messages[messages.length - 1]
		);

		const chatPayload: OllamaChatRequest = {
			model: this.settings?.chatModel!,
			stream: true,
			messages,
			options: {
				num_predict: this.interactionSettings?.chatMaxTokens ?? -1,
				temperature: 0.4,
				top_k: 30,
				top_p: 0.2,
				repeat_penalty: 1.1,
			},
		};

		truncateChatHistory(4, this.chatHistory);

		try {
			let completeMessage = "";
			for await (const chunk of this.generate(chatPayload, signal)) {
				completeMessage += chunk.message.content;
				yield chunk.message.content;
			}

			this.chatHistory.push({
				role: "assistant",
				content:
					completeMessage ||
					"The user has decided they weren't interested in the response",
			});
		} catch (e) {
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

		let systemPrompt = this.chatModel.genDocPrompt;
		if (ragContent) {
			systemPrompt += ragContent;
		}
		const genDocPrompt =
			"Generate documentation for the following code:\n" + prompt;

		const chatPayload: OllamaRequest = {
			model: this.settings?.chatModel!,
			prompt: genDocPrompt,
			system: systemPrompt,
			stream: false,
			options: {
				num_predict: 512,
				temperature: 0.4,
				top_k: 30,
				top_p: 0.2,
				repeat_penalty: 1.1,
				stop: [
					"<｜end▁of▁sentence｜>",
					"<｜EOT｜>",
					"\\n",
					"</s>",
					"<|eot_id|>",
				],
			},
		};

		const response = await this.fetchModelResponse(chatPayload, signal);
		if (!response) {
			return "";
		}
		const responseObject = (await response.json()) as OllamaResponse;
		return responseObject.response;
	}

	public async refactor(
		prompt: string,
		ragContent: string,
		signal: AbortSignal
	): Promise<string> {
		if (!this.chatModel?.refactorPrompt) {
			return "";
		}

		let systemPrompt = this.chatModel.refactorPrompt;
		if (ragContent) {
			systemPrompt += ragContent;
		}

		const refactorPayload: OllamaRequest = {
			model: this.settings?.chatModel!,
			prompt: prompt,
			system: systemPrompt,
			stream: false,
			options: {
				num_predict: this.interactionSettings?.chatMaxTokens ?? -1,
				temperature: 0.4,
				top_k: 20,
				top_p: 0.2,
				repeat_penalty: 1.1,
				stop: [
					"<｜end▁of▁sentence｜>",
					"<｜EOT｜>",
					"</s>",
					"<|eot_id|>",
				],
			},
		};

		const response = await this.fetchModelResponse(refactorPayload, signal);
		if (!response) {
			return "";
		}
		const responseObject = (await response.json()) as OllamaResponse;
		return responseObject.response;
	}
}
