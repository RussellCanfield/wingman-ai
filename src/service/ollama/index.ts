import type { OllamaAIModel } from "./types";
import type { InteractionSettings, Settings } from "@shared/types/Settings";
import type { AIProvider, ModelParams } from "../base";
import { CodeLlama } from "./models/codellama";
import { CodeQwen } from "./models/codeqwen";
import { Codestral } from "./models/codestral";
import { Deepseek } from "./models/deepseek";
import { Magicoder } from "./models/magicoder";
import type { OllamaRequest, OllamaResponse } from "./types";
import type { BaseChatModel } from "@langchain/core/language_models/chat_models";
import { ChatOllama, OllamaEmbeddings } from "@langchain/ollama";
import { Qwen } from "./models/qwen";
import type { ILoggingProvider } from "@shared/types/Logger";
import { Phi } from "./models/phi";
import type { Embeddings } from "@langchain/core/embeddings";
import path from "node:path";

export class Ollama implements AIProvider {
	codeModel: OllamaAIModel | undefined;
	interactionSettings: InteractionSettings | undefined;

	constructor(
		private readonly settings: Settings["providerSettings"]["Ollama"],
		interactionSettings: InteractionSettings,
		private readonly loggingProvider: ILoggingProvider,
		private readonly embeddingSettings: Settings["embeddingSettings"]["Ollama"],
	) {
		if (!settings) {
			throw new Error("Unable to load Ollama settings.");
		}

		this.codeModel = this.getCodeModel(this.settings!.codeModel);
	}

	getEmbedder(): Embeddings {
		return new OllamaEmbeddings({
			baseUrl: this.embeddingSettings!.baseUrl,
			model: this.embeddingSettings!.model,
			maxRetries: 2,
		});
	}

	getModel(params?: ModelParams): BaseChatModel {
		return new ChatOllama({
			baseUrl: this.settings!.baseUrl,
			model: this.settings!.chatModel,
			temperature: 0,
			streaming: true,
			maxRetries: 2,
			...(params ?? {}),
		});
	}

	getLightweightModel(): BaseChatModel {
		return new ChatOllama({
			baseUrl: this.embeddingSettings!.baseUrl,
			model: this.embeddingSettings!.summaryModel,
			temperature: 0,
			maxRetries: 2,
		});
	}

	async validateEmbeddingSettings(): Promise<boolean> {
		if (
			this.embeddingSettings &&
			(!this.embeddingSettings.baseUrl ||
				!this.embeddingSettings.baseUrl.trim() ||
				!this.embeddingSettings.dimensions ||
				Number.isNaN(this.embeddingSettings.dimensions) ||
				this.embeddingSettings.dimensions <= 0 ||
				!this.embeddingSettings.model ||
				!this.embeddingSettings.model.trim() ||
				!this.embeddingSettings.summaryModel ||
				!this.embeddingSettings.summaryModel.trim())
		) {
			throw new Error("Ollama embeddings are not configured properly.");
		}

		return true;
	}

	async validateSettings(): Promise<boolean> {
		if (
			!this.settings?.modelInfoPath.trim() ||
			!this.settings?.baseUrl.trim()
		) {
			throw new Error(
				"Ollama requires the base url and modelInfoPath configured.",
			);
		}

		if (
			!(await this.validateModelExists(this.settings?.chatModel ?? "unknown"))
		) {
			return false;
		}

		if (
			!(await this.validateModelExists(this.settings?.codeModel ?? "unknown"))
		) {
			return false;
		}

		if (!this.codeModel) return false;

		return true;
	}

	private getCodeModel(codeModel?: string): OllamaAIModel | undefined {
		if (!codeModel) return undefined;

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

	private async fetchModelResponse(
		payload: OllamaRequest,
		signal: AbortSignal,
	) {
		if (signal.aborted) {
			return undefined;
		}
		return fetch(new URL(this.settings?.apiPath!, this.settings?.baseUrl!), {
			method: "POST",
			body: JSON.stringify(payload),
			signal,
		});
	}

	public async validateModelExists(modelName: string): Promise<boolean> {
		try {
			const response = await fetch(
				new URL(this.settings?.modelInfoPath!, this.settings?.baseUrl),
				{
					method: "POST",
					body: JSON.stringify({
						name: modelName,
					}),
				},
			);

			if (response.status === 200) {
				return true;
			}
		} catch (error) {
			console.error(error);
		}

		return false;
	}

	public async codeComplete(
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
		)
			.replace("{ending}", ending)
			.replace(
				"{context}",
				`The following are all the types available. Use these types while considering how to complete the code provided. Do not repeat or use these types in your answer.

${additionalContext ?? ""}

-----

${
	recentClipboard
		? `The user recently copied these items to their clipboard, use them if they are relevant to the completion:
  
${recentClipboard}

-----`
		: ""
}`,
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
			response = await this.fetchModelResponse(codeRequestOptions, signal);
		} catch (error) {
			console.error(error);
		}

		const endTime = new Date().getTime();
		const executionTime = (endTime - startTime) / 1000;

		this.loggingProvider.logInfo(
			`Code Completion execution time: ${executionTime} seconds`,
		);

		if (!response?.body) {
			return "";
		}

		const ollamaResponse = (await response.json()) as OllamaResponse;
		return ollamaResponse.response;
	}
}
