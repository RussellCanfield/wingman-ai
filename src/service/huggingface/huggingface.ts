import * as vscode from "vscode";
import { AIProvider } from "../base";
import { Settings, defaultMaxTokens } from "../../types/Settings";
import { HuggingFaceAIModel } from "../../types/Models";
import { CodeLlama } from "./models/codellama";
import { Mistral } from "./models/mistral";
import { loggingProvider } from "../../providers/loggingProvider";
import { eventEmitter } from "../../events/eventEmitter";

type HuggingFaceRequest = {
	inputs: string;
	parameters?: {
		top_k?: number;
		top_p?: number;
		temperature?: number;
		max_new_tokens?: number;
		repetition_penalty?: number;
		return_full_text?: boolean;
		wait_for_model?: boolean;
		do_sample?: boolean;
	};
};

type HuggingFaceResponse = [
	{
		generated_text: string;
	}
];

export class HuggingFace implements AIProvider {
	settings: Settings["huggingface"];
	chatHistory: string = "";
	chatModel: HuggingFaceAIModel | undefined;
	codeModel: HuggingFaceAIModel | undefined;

	constructor() {
		const config = vscode.workspace.getConfiguration("Wingman");

		const huggingFaceConfig =
			config.get<Settings["huggingface"]>("HuggingFace");

		loggingProvider.logInfo(
			`HuggingFace settings loaded: ${JSON.stringify(huggingFaceConfig)}`
		);

		if (!huggingFaceConfig) {
			this.handleError("Unable to log HuggingFace configuration.");
			return;
		}

		this.settings = huggingFaceConfig!;

		if (!this.settings.apiKey.trim()) {
			const errorMsg = "Hugging Face API key is required.";
			vscode.window.showErrorMessage(errorMsg);
			loggingProvider.logInfo(errorMsg);
			throw new Error(errorMsg);
		}

		this.chatModel = this.getChatModel(this.settings.chatModel);
		this.codeModel = this.getCodeModel(this.settings.codeModel);
	}

	private handleError(message: string) {
		vscode.window.showErrorMessage(message);
		loggingProvider.logError(message);
		eventEmitter._onFatalError.fire();
		throw new Error(message);
	}

	private getCodeModel(codeModel: string): HuggingFaceAIModel | undefined {
		if (codeModel.includes("codellama")) {
			return new CodeLlama();
		} else if (codeModel.includes("mistral")) {
			return new Mistral();
		}

		this.handleError(
			"Invalid code model name, currently code supports the CodeLlama model."
		);
	}

	private getChatModel(chatModel: string): HuggingFaceAIModel | undefined {
		if (chatModel.includes("codellama")) {
			return new CodeLlama();
		} else if (chatModel.includes("mistral")) {
			return new Mistral();
		}

		this.handleError(
			"Invalid chat model name, currently chat supports the Mistral model."
		);
	}

	private getSafeUrl() {
		if (this.settings?.baseUrl.endsWith("/")) {
			return this.settings.baseUrl;
		}

		return `${this.settings?.baseUrl}/`;
	}

	private async fetchModelResponse(
		payload: HuggingFaceRequest,
		modelName: string,
		signal: AbortSignal
	) {
		if (signal.aborted) {
			return undefined;
		}
		return fetch(new URL(`${this.getSafeUrl()}${modelName}`), {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				Authorization: `Bearer ${this.settings?.apiKey}`,
			},
			body: JSON.stringify(payload),
			signal,
		});
	}

	async *generate(
		payload: HuggingFaceRequest,
		modelName: string,
		signal: AbortSignal
	) {
		const startTime = new Date().getTime();
		let response: Response | undefined;

		try {
			response = await this.fetchModelResponse(
				payload,
				modelName,
				signal
			);
		} catch (error) {
			loggingProvider.logError(
				`HuggingFace - chat request with model: ${modelName} failed with the following error: ${error}`
			);
		}

		const endTime = new Date().getTime();
		const executionTime = (endTime - startTime) / 1000;

		loggingProvider.logInfo(
			`HuggingFace - chat execution time: ${executionTime} seconds`
		);

		if (!response?.body) {
			return "";
		}

		if (response.status >= 400) {
			vscode.window.showErrorMessage(await response.text());
			return "";
		}

		const contents = (await response.json()) as HuggingFaceResponse;

		if (!contents.length) {
			return "";
		}

		yield contents[0].generated_text;
	}

	public async codeComplete(
		beginning: string,
		ending: string,
		signal: AbortSignal
	): Promise<string> {
		const startTime = new Date().getTime();

		const codeRequestOptions: HuggingFaceRequest = {
			inputs: this.codeModel!.CodeCompletionPrompt.replace(
				"{beginning}",
				beginning
			).replace("{ending}", ending),
			parameters: {
				repetition_penalty: 1.3,
				temperature: 0.4,
				top_k: 30,
				top_p: 0.2,
				max_new_tokens:
					this.settings?.codeMaxTokens ?? defaultMaxTokens,
				return_full_text: false,
				wait_for_model: true,
				do_sample: false,
			},
		};

		let response: Response | undefined;

		try {
			response = await this.fetchModelResponse(
				codeRequestOptions,
				this.settings?.codeModel!,
				signal
			);
		} catch (error) {
			loggingProvider.logError(
				`HuggingFace - code completion request with model ${this.settings?.codeModel} failed with the following error: ${error}`
			);
		}

		const endTime = new Date().getTime();
		const executionTime = (endTime - startTime) / 1000;

		loggingProvider.logInfo(
			`HuggingFace - Code Completion execution time: ${executionTime} seconds`
		);

		if (!response?.body) {
			return "";
		}

		const huggingFaceResponse =
			(await response.json()) as HuggingFaceResponse;
		return huggingFaceResponse.length > 0
			? huggingFaceResponse[0].generated_text
			: "";
	}

	public clearChatHistory(): void {
		this.chatHistory = "";
	}

	public async *chat(
		prompt: string,
		ragContent: string,
		signal: AbortSignal
	) {
		const chatPayload: HuggingFaceRequest = {
			inputs: this.chatModel!.ChatPrompt.replace(
				"{chat_history}",
				this.chatHistory ?? ""
			)
				.replace("{context}", ragContent ?? "")
				.replace("{question}", prompt ?? "")
				.replace(/\t/, ""),
			parameters: {
				temperature: 0.4,
				top_k: 30,
				top_p: 0.2,
				return_full_text: false,
				max_new_tokens:
					this.settings?.chatMaxTokens ?? defaultMaxTokens,
			},
		};

		this.clearChatHistory();

		//left incase HF implements streaming.
		for await (const chunk of this.generate(
			chatPayload,
			this.settings?.chatModel!,
			signal
		)) {
			yield chunk;
		}
	}
}
