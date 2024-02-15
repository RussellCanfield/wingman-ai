import * as vscode from "vscode";
import { eventEmitter } from "../../events/eventEmitter";
import { loggingProvider } from "../../providers/loggingProvider";
import { OllamaAIModel } from "../../types/Models";
import {
	InteractionSettings,
	Settings
} from "../../types/Settings";
import { asyncIterator } from "../asyncIterator";
import { AIStreamProvicer, GetInteractionSettings } from "../base";
import { CodeLlama } from "./models/codellama";
import { Deepseek } from "./models/deepseek";
import { PhindCodeLlama } from "./models/phind-codellama";
import { OllamaRequest, OllamaResponse } from "./types";

export class Ollama implements AIStreamProvicer {
	decoder = new TextDecoder();
	settings: Settings["ollama"];
	chatHistory: number[] = [];
	chatModel: OllamaAIModel | undefined;
	codeModel: OllamaAIModel | undefined;
	interactionSettings: InteractionSettings | undefined;

	constructor() {
		const config = vscode.workspace.getConfiguration("Wingman");

		const ollamaConfig = config.get<Settings["ollama"]>("Ollama");

		loggingProvider.logInfo(
			`Ollama settings loaded: ${JSON.stringify(ollamaConfig)}`
		);

		if (!ollamaConfig) {
			this.handleError("Unable to load Ollama settings.");
			return;
		}

		this.settings = ollamaConfig;

		this.chatModel = this.getChatModel(this.settings.chatModel);
		this.codeModel = this.getCodeModel(this.settings.codeModel);

		this.interactionSettings = GetInteractionSettings();

		this.validateSettings();
	}

	private handleError(message: string) {
		vscode.window.showErrorMessage(message);
		loggingProvider.logError(message);
		eventEmitter._onFatalError.fire();
		throw new Error(message);
	}

	private async validateSettings() {
		if (
			!(await this.validateModelExists(
				this.settings?.chatModel ?? "unknown"
			))
		) {
			this.handleError(
				`Unable to verify Ollama has chat model: ${this.settings?.chatModel}, have you pulled the model or is the config wrong?`
			);
		}

		if (
			!(await this.validateModelExists(
				this.settings?.codeModel ?? "unknown"
			))
		) {
			this.handleError(
				`Unable to verify Ollama has code model: ${this.settings?.codeModel}, have you pulled the model or is the config wrong?`
			);
		}
	}

	private getCodeModel(codeModel: string): OllamaAIModel | undefined {
		switch (true) {
			case codeModel.startsWith("codellama"):
				return new CodeLlama();
			case codeModel.startsWith("deepseek"):
				return new Deepseek();
			default:
				this.handleError(
					"Invalid code model name, currently code supports CodeLlama and Deepseek models."
				);
		}
	}

	private getChatModel(chatModel: string): OllamaAIModel | undefined {
		switch (true) {
			case chatModel.startsWith("codellama"):
				return new CodeLlama();
			case chatModel.startsWith("deepseek"):
				return new Deepseek();
			case chatModel.startsWith("phind"):
				return new PhindCodeLlama();
			default:
				this.handleError(
					"Invalid chat model name, currently chat supports CodeLlama, Phind CodeLlama and Deepseek models."
				);
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
			loggingProvider.logInfo(JSON.stringify(error));
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

	async *generate(payload: OllamaRequest, signal: AbortSignal) {
		const startTime = new Date().getTime();
		let response: Response | undefined;

		try {
			response = await this.fetchModelResponse(payload, signal);
		} catch (error) {
			loggingProvider.logError(
				`Ollama chat request with model: ${payload.model} failed with the following error: ${error}`
			);
		}

		if (!response?.body) {
			return "";
		}

		const endTime = new Date().getTime();
		const executionTime = (endTime - startTime) / 1000;

		loggingProvider.logInfo(
			`Ollama - Chat Time To First Token execution time: ${executionTime} seconds`
		);

		for await (const chunk of asyncIterator(response.body)) {
			if (signal.aborted) return;
			const jsonString = this.decoder.decode(chunk);
			// we can have more then one ollama response
			const jsonStrings = jsonString
				.replace(/}\n{/gi, "}\u241e{")
				.split("\u241e");
			try {
				for (const json of jsonStrings) {
					const result = JSON.parse(json) as OllamaResponse;
					yield result;
				}
			} catch (e) {
				console.warn(e);
				console.log(jsonString);
			}
		}
	}

	private async *generateCode(payload: OllamaRequest, signal: AbortSignal) {
		const startTime = new Date().getTime();
		let response: Response | undefined;

		try {
			response = await this.fetchModelResponse(payload, signal);
		} catch (error) {
			loggingProvider.logError(
				`Ollama chat request with model: ${payload.model} failed with the following error: ${error}`
			);
			eventEmitter._onQueryComplete.fire();
		}

		if (!response?.body) {
			return "";
		}

		const endTime = new Date().getTime();
		const executionTime = (endTime - startTime) / 1000;

		loggingProvider.logInfo(
			`Ollama - Chat Time To First Token execution time: ${executionTime} seconds`
		);

		for await (const chunk of asyncIterator(response.body)) {
			if (signal.aborted) return;
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
				yield codeLines.join('');
			} catch (e) {
				loggingProvider.logError(`Error occured on ollama code generation ${e}`);
				eventEmitter._onQueryComplete.fire();
			}
		}
	}

	public async codeComplete(
		beginning: string,
		ending: string,
		signal: AbortSignal
	): Promise<string> {
		const startTime = new Date().getTime();

		const codeRequestOptions: OllamaRequest = {
			model: this.settings?.codeModel!,
			prompt: this.codeModel!.CodeCompletionPrompt.replace(
				"{beginning}",
				beginning
			).replace("{ending}", ending),
			stream: false,
			raw: true,
			options: {
				temperature: 0.6,
				num_predict: this.interactionSettings?.codeMaxTokens ?? -1,
				top_k: 30,
				top_p: 0.2,
				repeat_penalty: 1.1,
				stop: ["<｜end▁of▁sentence｜>", "<｜EOT｜>", "\\n", "</s>"],
			},
		};

		loggingProvider.logInfo(
			`Ollama - Code Completion submitting request with body: ${JSON.stringify(
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
				`Ollama - code completion request with model ${this.settings?.codeModel} failed with the following error: ${error}`
			);
		}

		const endTime = new Date().getTime();
		const executionTime = (endTime - startTime) / 1000;

		loggingProvider.logInfo(
			`Ollama - Code Completion execution time: ${executionTime} seconds`
		);

		if (!response?.body) {
			return "";
		}

		const ollamaResponse = (await response.json()) as OllamaResponse;
		return ollamaResponse.response;
	}

	private codeCompleteRequest = async (sentences: string[], codeRequestOptions: OllamaRequest, signal: AbortSignal) => {
		let words: string[] = [];
		for await (const characters of this.generateCode(codeRequestOptions, signal)) {
			if (!characters) {
				continue;
			}
			if (characters.indexOf('\n') > -1) {
				const splitOnLine = characters.split('\n');
				let x = 0;
				for (; x < splitOnLine.length - 1; x++) {
					words.push(splitOnLine[x]);
					sentences.push(words.join(''));
					words = [];
				}
				words.push(splitOnLine[x]);
			}
			else {
				words.push(characters);
			}
		}
	};

	public async codeCompleteStream(beginning: string, ending: string, signal: AbortSignal): Promise<string> {
		const prompt = this.codeModel!.CodeCompletionPrompt.replace(
			"{beginning}",
			beginning
		).replace("{ending}", ending);
		const codeRequestOptions: OllamaRequest = {
			model: this.settings?.codeModel!,
			prompt,
			stream: true,
			raw: true,
			options: {
				temperature: 0.3,
				num_predict: this.interactionSettings?.codeMaxTokens ?? -1,
				top_k: 30,
				top_p: 0.2,
				repeat_penalty: 1.1,
				stop: ["<｜end▁of▁sentence｜>", "<｜EOT｜>"],
			},
		};

		let sentences: string[] = [];
		this.codeCompleteRequest(sentences, codeRequestOptions, signal);
		return new Promise((res) => {
			setTimeout(() => {
				res(sentences.join('\n'));
			}, 600);
		});
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
            ${ragContent}`;
		}

		systemPrompt = systemPrompt.replace(/\t/, "");

		const chatPayload: OllamaRequest = {
			model: this.settings?.chatModel!,
			prompt,
			system: systemPrompt,
			stream: true,
			context: this.chatHistory,
			options: {
				num_predict: this.interactionSettings?.chatMaxTokens ?? -1,
				temperature: 0.4,
				top_k: 30,
				top_p: 0.2,
				repeat_penalty: 1.1,
				stop: ["<｜end▁of▁sentence｜>", "<｜EOT｜>", "\\n", "</s>"],
			},
		};

		loggingProvider.logInfo(
			`Ollama - Chat submitting request with body: ${JSON.stringify(
				chatPayload
			)}`
		);

		this.clearChatHistory();

		for await (const chunk of this.generate(chatPayload, signal)) {
			const { response, context } = chunk;
			this.chatHistory = this.chatHistory.concat(context);
			yield response;
		}
	}
}
