import * as vscode from "vscode";
import { AIProvider } from "../base";
import { Settings } from "../../types/Settings";
import { HuggingFaceAIModel } from "../../types/Models";
import { CodeLlama } from "./models/codellama";
import { Mistral } from "./models/mistral";

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

		console.log("HuggingFace settings loaded: ", huggingFaceConfig);

		if (huggingFaceConfig) {
			this.settings = huggingFaceConfig;

			if (!this.settings.apiKey.trim()) {
				vscode.window.showErrorMessage(
					"Hugging Face API key is required."
				);
				throw new Error("Missing Hugging Face API key.");
			}

			this.chatModel = this.getChatModel(this.settings.chatModel);
			this.codeModel = this.getCodeModel(this.settings.codeModel);
		}
	}

	private getCodeModel(codeModel: string): HuggingFaceAIModel {
		if (codeModel.includes("codellama")) {
			return new CodeLlama();
		} else if (codeModel.includes("mistral")) {
			return new Mistral();
		} else {
			vscode.window.showErrorMessage(
				"Invalid code model name, currently code supports the CodeLlama model."
			);
			throw new Error("Invalid code model name");
		}
	}

	private getChatModel(chatModel: string): HuggingFaceAIModel {
		if (chatModel.includes("codellama")) {
			return new CodeLlama();
		} else if (chatModel.includes("mistral")) {
			return new Mistral();
		} else {
			vscode.window.showErrorMessage(
				"Invalid chat model name, currently chat supports the Mistral model."
			);
			throw new Error("Invalid chat model name");
		}
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
			return null;
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
		const response = await this.fetchModelResponse(
			payload,
			modelName,
			signal
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
				max_new_tokens: 1024,
				return_full_text: false,
				wait_for_model: true,
				do_sample: false,
			},
		};

		const response = await this.fetchModelResponse(
			codeRequestOptions,
			this.settings?.codeModel!,
			signal
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
		//let chatPrompt = this.chatModel!.ChatPrompt;

		// if (ragContent) {
		// 	systemPrompt += `Here's some additional information that may help you generate a more accurate response.
		//     Please determine if this information is relevant and can be used to supplement your response:
		//     ${ragContent}`;
		// }

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
				max_new_tokens: 1024,
			},
		};

		this.clearChatHistory();

		for await (const chunk of this.generate(
			chatPayload,
			this.settings?.chatModel!,
			signal
		)) {
			yield chunk;
		}
	}
}
