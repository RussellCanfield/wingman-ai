import * as vscode from "vscode";
import { OllamaRequest, OllamaResponse } from "./types";
import { asyncIterator } from "../asyncIterator";
import { AIProvider } from "../base";
import { Settings, defaultMaxTokens } from "../../types/Settings";
import { OllamaAIModel } from "../../types/Models";
import { CodeLlama } from "./models/codellama";
import { Deepseek } from "./models/deepseek";
import { PhindCodeLlama } from "./models/phind-codellama";

export class Ollama implements AIProvider {
	decoder = new TextDecoder();
	settings: Settings["ollama"];
	chatHistory: number[] = [];
	chatModel: OllamaAIModel | undefined;
	codeModel: OllamaAIModel | undefined;

	constructor() {
		const config = vscode.workspace.getConfiguration("Wingman");

		const ollamaConfig = config.get<Settings["ollama"]>("Ollama");

		console.log("Ollama settings loaded: ", ollamaConfig);

		if (ollamaConfig) {
			this.settings = ollamaConfig;

			this.chatModel = this.getChatModel(this.settings.chatModel);
			this.codeModel = this.getCodeModel(this.settings.codeModel);
		}

		if (!this.validateModelExists(this.settings?.chatModel ?? "unknown")) {
			vscode.window.showErrorMessage(
				`Unable to verify Ollama has chat model: ${this.settings?.chatModel}, have you pulled the model or is the config wrong?`
			);
		}

		if (!this.validateModelExists(this.settings?.codeModel ?? "unknown")) {
			vscode.window.showErrorMessage(
				`Unable to verify Ollama has code model: ${this.settings?.codeModel}, have you pulled the model or is the config wrong?`
			);
		}
	}

	private getCodeModel(codeModel: string): OllamaAIModel {
		switch (true) {
			case codeModel.startsWith("codellama"):
				return new CodeLlama();
			case codeModel.startsWith("deepseek"):
				return new Deepseek();
			default:
				vscode.window.showErrorMessage(
					"Invalid code model name, currently code supports CodeLlama and Deepseek models."
				);
				throw new Error("Invalid code model name");
		}
	}

	private getChatModel(chatModel: string): OllamaAIModel {
		switch (true) {
			case chatModel.startsWith("codellama"):
				return new CodeLlama();
			case chatModel.startsWith("deepseek"):
				return new Deepseek();
			case chatModel.startsWith("phind"):
				return new PhindCodeLlama();
			default:
				vscode.window.showErrorMessage(
					"Invalid chat model name, currently chat supports CodeLlama, Phind CodeLlama and Deepseek models."
				);
				throw new Error("Invalid chat model name");
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
			console.warn(error);
		}

		return false;
	}

	private async fetchModelResponse(
		payload: OllamaRequest,
		signal: AbortSignal
	) {
		if (signal.aborted) {
			return null;
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
		const response = await this.fetchModelResponse(payload, signal);

		if (!response?.body) {
			return "";
		}

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
				temperature: 0.3,
				num_predict: this.settings?.codeMaxTokens ?? defaultMaxTokens,
				top_k: 30,
				top_p: 0.2,
				repeat_penalty: 1.3,
				stop: ["<｜end▁of▁sentence｜>", "<｜EOT｜>", "\\n", "</s>"],
			},
		};

		const response = await this.fetchModelResponse(
			codeRequestOptions,
			signal
		);

		const endTime = new Date().getTime();
		const executionTime = (endTime - startTime) / 1000;

		console.log(`Ollama Execution time: ${executionTime} seconds`);

		if (!response?.body) {
			return "";
		}

		const ollamaResponse = (await response.json()) as OllamaResponse;
		return ollamaResponse.response;
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
				num_predict: this.settings?.chatMaxTokens ?? defaultMaxTokens,
				temperature: 0.6,
				top_k: 30,
				top_p: 0.2,
			},
		};

		this.clearChatHistory();

		for await (const chunk of this.generate(chatPayload, signal)) {
			const { response, context } = chunk;
			this.chatHistory = this.chatHistory.concat(context);
			yield response;
		}
	}
}
