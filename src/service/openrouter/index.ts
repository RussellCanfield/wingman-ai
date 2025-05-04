import type { InteractionSettings, Settings } from "@shared/types/Settings";
import { OpenRouterModel } from "./models/generic";
import type { OpenAIModel } from "@shared/types/Models";
import type { BaseChatModel } from "@langchain/core/language_models/chat_models";
import { ChatOpenAI, OpenAI, OpenAIEmbeddings } from "@langchain/openai";
import type { AIProvider, ModelParams } from "../base";
import type { ILoggingProvider } from "@shared/types/Logger";
import type { Embeddings } from "@langchain/core/embeddings";

export class OpenRouter implements AIProvider {
	codeModel: OpenRouterModel | undefined;

	constructor(
		private readonly settings: Settings["providerSettings"]["OpenRouter"],
		private readonly interactionSettings: InteractionSettings,
		private readonly loggingProvider: ILoggingProvider,
		private readonly embeddingSettings?: Settings["embeddingSettings"]["OpenRouter"],
	) {
		if (!settings) {
			throw new Error("Unable to load OpenRouter settings.");
		}

		this.codeModel = this.getCodeModel(this.settings!.codeModel);
	}

	getEmbedder(): Embeddings {
		return new OpenAIEmbeddings({
			apiKey: this.embeddingSettings?.apiKey,
			model: this.embeddingSettings?.model,
			openAIApiKey: this.embeddingSettings?.apiKey,
			configuration: {
				baseURL: this.settings?.baseUrl,
			},
		});
	}

	getLightweightModel() {
		return new OpenAI({
			apiKey: this.embeddingSettings?.apiKey,
			model: this.embeddingSettings?.summaryModel,
			openAIApiKey: this.embeddingSettings?.apiKey,
			maxTokens: this.interactionSettings.chatMaxTokens,
			configuration: {
				baseURL: this.settings?.baseUrl,
			},
		});
	}

	getModel(params?: ModelParams): BaseChatModel {
		const targetModel = params?.model ?? this.settings?.chatModel;
		return new ChatOpenAI({
			apiKey: this.settings?.apiKey,
			model: targetModel,
			openAIApiKey: this.settings?.apiKey,
			maxTokens: this.interactionSettings.chatMaxTokens,
			...(params ?? {}),
			configuration: {
				baseURL: this.settings?.baseUrl,
			},
		});
	}

	async validateEmbeddingSettings(): Promise<boolean> {
		if (
			this.embeddingSettings &&
			(!this.embeddingSettings.apiKey ||
				!this.embeddingSettings.baseUrl ||
				!this.embeddingSettings.apiKey.trim() ||
				!this.embeddingSettings.dimensions ||
				Number.isNaN(this.embeddingSettings.dimensions) ||
				this.embeddingSettings.dimensions <= 0 ||
				!this.embeddingSettings.model ||
				!this.embeddingSettings.model.trim() ||
				!this.embeddingSettings.summaryModel ||
				!this.embeddingSettings.summaryModel.trim())
		) {
			throw new Error("OpenRouter embeddings are not configured properly.");
		}

		return true;
	}

	async validateSettings() {
		if (!this.settings?.apiKey.trim() || !this.settings?.baseUrl.trim()) {
			throw new Error("OpenRouter requires an api key and a base url.");
		}

		return true;
	}

	private getCodeModel(codeModel: string): OpenAIModel | undefined {
		return new OpenRouterModel();
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
				`The following are some of the types available in their file. 
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
}`,
			);

		try {
			const response = await this.getModel({
				temperature: 0.2,
				model: this.settings?.codeModel,
			}).invoke(prompt, { signal });

			return response.content.toString();
		} catch (error) {
			this.loggingProvider.logError(error);
		}

		return "";
	}
}
