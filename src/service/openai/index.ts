import type { InteractionSettings, Settings } from "@shared/types/Settings";
import { GPTModel } from "./models/gptmodel";
import type { OpenAIModel } from "@shared/types/Models";
import { ChatOpenAI, OpenAIEmbeddings } from "@langchain/openai";
import type { AIProvider, ModelParams } from "../base";
import type { ILoggingProvider } from "@shared/types/Logger";
import type { Embeddings } from "@langchain/core/embeddings";

const reasoningModels = ["o3-mini"];

export class OpenAI implements AIProvider {
	codeModel: OpenAIModel | undefined;

	constructor(
		private readonly settings: Settings["providerSettings"]["OpenAI"],
		private readonly interactionSettings: InteractionSettings,
		private readonly loggingProvider: ILoggingProvider,
		private readonly embeddingSettings?: Settings["embeddingSettings"]["OpenAI"],
	) {
		if (!settings) {
			throw new Error("Unable to load OpenAI settings.");
		}

		this.codeModel = this.getCodeModel(this.settings!.codeModel);
	}

	getEmbedder(): Embeddings {
		return new OpenAIEmbeddings({
			apiKey: this.embeddingSettings?.apiKey,
			model: this.embeddingSettings?.model,
			openAIApiKey: this.embeddingSettings?.apiKey,
		});
	}

	getLightweightModel() {
		return new ChatOpenAI({
			apiKey: this.embeddingSettings?.apiKey,
			model: this.embeddingSettings?.summaryModel,
			openAIApiKey: this.embeddingSettings?.apiKey,
		});
	}

	getModel(params?: ModelParams) {
		const targetModel = params?.model ?? this.settings?.chatModel;
		const isReasoningModel = reasoningModels.some((reasoningModel) =>
			targetModel?.startsWith(reasoningModel),
		);

		return new ChatOpenAI({
			apiKey: this.settings?.apiKey,
			model: targetModel,
			openAIApiKey: this.settings?.apiKey,
			reasoningEffort: isReasoningModel ? "medium" : undefined,
			...(params ?? {}),
		});
	}

	async validateEmbeddingSettings() {
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
			throw new Error("OpenAI embeddings are not configured properly.");
		}
		return true;
	}

	async validateSettings() {
		if (!this.settings?.apiKey || !this.settings.apiKey.trim()) {
			throw new Error("OpenAI API key is required.");
		}

		const isChatModelValid =
			this.settings?.chatModel?.startsWith("gpt-4") ||
			this.settings?.chatModel?.startsWith("o") ||
			false;
		const isCodeModelValid =
			this.settings?.codeModel?.startsWith("gpt-4") ||
			this.settings?.codeModel?.startsWith("o") ||
			false;

		return isChatModelValid && isCodeModelValid;
	}

	private getCodeModel(codeModel: string): OpenAIModel | undefined {
		return new GPTModel();
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
