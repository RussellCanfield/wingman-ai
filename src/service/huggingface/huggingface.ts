import { HuggingFaceAIModel } from "@shared/types/Models";
import { InteractionSettings, Settings } from "@shared/types/Settings";
import { asyncIterator } from "../asyncIterator";
import { AIProvider } from "../base";
import { CodeLlama } from "./models/codellama";
import { Mistral } from "./models/mistral";
import { Mixtral } from "./models/mixtral";
import { Starcoder2 } from "./models/starcoder2";
import { AIMessageChunk } from "@langchain/core/messages";
import { BaseChatModel } from "@langchain/core/language_models/chat_models";

type HuggingFaceRequest = {
	inputs: string;
	stream?: boolean;
	parameters: {
		top_k?: number;
		top_p?: number;
		temperature?: number;
		max_new_tokens?: number;
		repetition_penalty?: number;
		return_full_text?: boolean;
		do_sample?: boolean;
	};
	options: {
		wait_for_model?: boolean;
	};
};

type HuggingFaceResponse = [
	{
		generated_text: string;
	}
];

type HuggingFaceStreamResponse = {
	token: {
		text: string;
	};
};

export class HuggingFace implements AIProvider {
	decoder = new TextDecoder();
	chatHistory: string = "";
	chatModel: HuggingFaceAIModel | undefined;
	codeModel: HuggingFaceAIModel | undefined;

	constructor(
		private readonly settings: Settings["providerSettings"]["HuggingFace"],
		private readonly interactionSettings: InteractionSettings
	) {
		if (!settings) {
			throw new Error("Unable to log HuggingFace configuration.");
		}

		if (!this.settings?.apiKey.trim()) {
			throw new Error("Hugging Face API key is required.");
		}

		this.chatModel = this.getChatModel(this.settings.chatModel);
		this.codeModel = this.getCodeModel(this.settings.codeModel);
	}

	async validateSettings(): Promise<boolean> {
		const isChatModelValid =
			this.settings?.chatModel?.startsWith("mistralai/Mistral") ||
			this.settings?.chatModel?.startsWith("mistralai/Mixtral") ||
			false;
		const isCodeModelValid =
			this.settings?.codeModel?.startsWith("codellama") ||
			this.settings?.codeModel?.startsWith("bigcode/starcoder2") ||
			false;
		return isChatModelValid && isCodeModelValid;
	}

	getModel(): BaseChatModel {
		throw new Error("Method not implemented.");
	}

	getRerankModel(): BaseChatModel {
		throw new Error("Method not implemented.");
	}

	invoke(prompt: string): Promise<AIMessageChunk> {
		throw new Error("Method not implemented.");
	}

	private getCodeModel(codeModel: string): HuggingFaceAIModel | undefined {
		if (codeModel.startsWith("codellama")) {
			return new CodeLlama();
		} else if (codeModel.startsWith("bigcode/starcoder2")) {
			return new Starcoder2();
		}
	}

	private getChatModel(chatModel: string): HuggingFaceAIModel | undefined {
		if (chatModel.startsWith("mistralai/Mistral")) {
			return new Mistral();
		} else if (chatModel.startsWith("mistralai/Mixtral")) {
			return new Mixtral();
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
			return;
			`HuggingFace - chat request with model: ${modelName} failed with the following error: ${error}`;
		}

		const endTime = new Date().getTime();
		const executionTime = (endTime - startTime) / 1000;

		console.log(
			`Chat Time To First Token execution time: ${executionTime} ms`
		);

		if (!response?.body) {
			return "";
		}

		if (response.status >= 400) {
			console.log(await response.text());
			return "";
		}

		let currentMessage = "";
		for await (const chunk of asyncIterator(response.body)) {
			if (signal.aborted) {
				return "";
			}

			const decodedValue = this.decoder.decode(chunk);

			currentMessage += decodedValue;

			// Check if we have a complete event
			const eventEndIndex = currentMessage.indexOf("\n\n");
			if (eventEndIndex !== -1) {
				// Extract the event data
				const eventData = currentMessage.substring(0, eventEndIndex);

				// Remove the event data from currentMessage
				currentMessage = currentMessage.substring(eventEndIndex + 2);

				// Remove the "data: " prefix and parse the JSON
				const jsonStr = eventData.replace(/^data:/, "");
				const parsedData = JSON.parse(
					jsonStr
				) as HuggingFaceStreamResponse;

				// Yield the token text
				yield parsedData.token.text;
			}
		}
	}

	public async codeComplete(
		beginning: string,
		ending: string,
		signal: AbortSignal,
		additionalContext?: string
	): Promise<string> {
		const startTime = new Date().getTime();
		const prompt = this.codeModel!.CodeCompletionPrompt.replace(
			"{beginning}",
			beginning
		).replace("{ending}", ending);
		const codeRequestOptions: HuggingFaceRequest = {
			inputs: `The following are all the types available. Use these types while considering how to complete the code provided. Do not repeat or use these types in your answer.

${additionalContext ?? ""}

-----

${prompt}`,
			parameters: {
				repetition_penalty: 1.1,
				temperature: 0.4,
				top_k: 30,
				top_p: 0.2,
				max_new_tokens: this.interactionSettings?.codeMaxTokens,
				return_full_text: false,
				do_sample: false,
			},
			options: {
				wait_for_model: true,
			},
		};

		if (this.interactionSettings?.codeMaxTokens === -1) {
			delete codeRequestOptions.parameters.max_new_tokens;
		}

		return `HuggingFace - Code Completion submitting request with body: ${JSON.stringify(
			codeRequestOptions
		)}`;

		let response: Response | undefined;

		try {
			response = await this.fetchModelResponse(
				codeRequestOptions,
				this.settings?.codeModel!,
				signal
			);
		} catch (error) {
			return `HuggingFace - code completion request with model ${this.settings?.codeModel} failed with the following error: ${error}`;
		}

		const endTime = new Date().getTime();
		const executionTime = (endTime - startTime) / 1000;

		console.log(`Code Completion execution time: ${executionTime} seconds`);

		if (!response || !response?.body) {
			return "";
		}

		const huggingFaceResponse =
			(await response?.json()) as HuggingFaceResponse;
		return huggingFaceResponse.length > 0
			? //temporary fix. Not sure why HF doesn't specify stop tokens
			  huggingFaceResponse[0].generated_text.replace("<EOT>", "")
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
			stream: true,
			parameters: {
				repetition_penalty: 1.1,
				temperature: 0.4,
				top_k: 30,
				top_p: 0.2,
				return_full_text: false,
				max_new_tokens: this.interactionSettings?.chatMaxTokens,
			},
			options: {
				wait_for_model: true,
			},
		};

		if (this.interactionSettings?.chatMaxTokens === -1) {
			delete chatPayload.parameters.max_new_tokens;
		}

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

	public async genCodeDocs(
		prompt: string,
		ragContent: string,
		signal: AbortSignal
	): Promise<string> {
		if (!this.chatModel?.genDocPrompt) return "";

		const genDocPrompt =
			"Generate documentation for the following code:\n" + prompt;

		const promptInput = this.chatModel!.genDocPrompt.replace(
			"{context}",
			ragContent ?? ""
		)
			.replace("{code}", genDocPrompt ?? "")
			.replace(/\t/, "");

		const chatPayload: HuggingFaceRequest = {
			inputs: promptInput,
			stream: false,
			parameters: {
				repetition_penalty: 1.1,
				temperature: 0.4,
				top_k: 30,
				top_p: 0.2,
				max_new_tokens: 512,
				return_full_text: false,
				do_sample: false,
			},
			options: {
				wait_for_model: true,
			},
		};

		const response = await this.fetchModelResponse(
			chatPayload,
			this.settings?.chatModel!,
			signal
		);
		if (!response) {
			return "";
		}
		const huggingFaceResponse =
			(await response.json()) as HuggingFaceResponse;
		return huggingFaceResponse.length > 0
			? //temporary fix. Not sure why HF doesn't specify stop tokens
			  huggingFaceResponse[0].generated_text.replace("<EOT>", "")
			: "";
	}

	public async refactor(
		prompt: string,
		ragContent: string,
		signal: AbortSignal
	): Promise<string> {
		if (!this.chatModel?.refactorPrompt) return "";

		const promptInput = this.chatModel!.refactorPrompt.replace(
			"{context}",
			ragContent ?? ""
		)
			.replace("{code}", prompt ?? "")
			.replace(/\t/, "");

		const chatPayload: HuggingFaceRequest = {
			inputs: promptInput,
			stream: false,
			parameters: {
				repetition_penalty: 1.1,
				temperature: 0.6,
				top_k: 30,
				top_p: 0.3,
				max_new_tokens: this.interactionSettings?.chatMaxTokens,
				return_full_text: false,
				do_sample: false,
			},
			options: {
				wait_for_model: true,
			},
		};

		const response = await this.fetchModelResponse(
			chatPayload,
			this.settings?.chatModel!,
			signal
		);
		if (!response) {
			return "";
		}
		const huggingFaceResponse =
			(await response.json()) as HuggingFaceResponse;
		return huggingFaceResponse.length > 0
			? //temporary fix. Not sure why HF doesn't specify stop tokens
			  huggingFaceResponse[0].generated_text.replace("<EOT>", "")
			: "";
	}
}
