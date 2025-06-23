import type { InteractionSettings, Settings } from "@shared/types/Settings";
import { GoogleModel } from "./models/generic";
import type { OpenAIModel } from "@shared/types/Models";
import type { AIProvider, ModelParams } from "../base";
import type { ILoggingProvider } from "@shared/types/Logger";
import type { Embeddings } from "@langchain/core/embeddings";
import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { GoogleGenerativeAIEmbeddings } from "@langchain/google-genai";
import { GoogleGenAI } from "@google/genai";

export class Google implements AIProvider {
	codeModel: GoogleModel | undefined;

	constructor(
		private readonly settings: Settings["providerSettings"]["Google"],
		private readonly interactionSettings: InteractionSettings,
		private readonly loggingProvider: ILoggingProvider,
		private readonly embeddingSettings?: Settings["embeddingSettings"]["Google"],
	) {
		if (!settings) {
			throw new Error("Unable to load Google settings.");
		}

		this.codeModel = this.getCodeModel(this.settings!.codeModel);
	}

	async generateImage(input: string) {
		const ai = new GoogleGenAI({ apiKey: this.settings.apiKey });

		const response = await ai.models.generateContent({
			model: "gemini-2.0-flash-exp-image-generation",
			contents: input,
			config: {
				responseModalities: ["Text", "Image"],
			},
		});

		if (!response.candidates?.length) {
			return undefined;
		}

		for (const part of response.candidates[0].content?.parts!) {
			if (part.inlineData) {
				return part.inlineData.data;
			}
		}

		return undefined;
	}

	getEmbedder(): Embeddings {
		return new GoogleGenerativeAIEmbeddings({
			apiKey: this.embeddingSettings?.apiKey,
			model: this.embeddingSettings?.model,
		});
	}

	getLightweightModel() {
		return new ChatGoogleGenerativeAI({
			model: this.settings.chatModel,
			temperature: 0,
			maxRetries: 2,
			apiKey: this.settings.apiKey,
		});
	}

	getModel(params?: ModelParams) {
		const targetModel = params?.model ?? this.settings?.chatModel;
		return new ChatGoogleGenerativeAI({
			model: targetModel,
			temperature: 0,
			maxRetries: 2,
			streaming: params?.streaming ?? true,
			apiKey: this.settings.apiKey,
		});
	}

	async validateEmbeddingSettings(): Promise<boolean> {
		if (
			this.embeddingSettings &&
			(!this.embeddingSettings.apiKey ||
				!this.embeddingSettings.apiKey.trim() ||
				!this.embeddingSettings.dimensions ||
				Number.isNaN(this.embeddingSettings.dimensions) ||
				this.embeddingSettings.dimensions <= 0 ||
				!this.embeddingSettings.model ||
				!this.embeddingSettings.model.trim() ||
				!this.embeddingSettings.summaryModel ||
				!this.embeddingSettings.summaryModel.trim())
		) {
			throw new Error(
				"Google AI Studio embeddings are not configured properly.",
			);
		}

		return true;
	}

	async validateSettings() {
		if (
			!this.settings?.apiKey ||
			!this.settings.apiKey.trim() ||
			!this.settings?.baseUrl ||
			!this.settings.baseUrl.trim()
		) {
			throw new Error("Google AI Studio requires an api key and a base url.");
		}

		return true;
	}

	private getCodeModel(codeModel: string): OpenAIModel | undefined {
		return new GoogleModel();
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
