import type { InteractionSettings, Settings } from "@shared/types/Settings";
import { LMStudioModel } from "./models/generic";
import type { OpenAIModel } from "@shared/types/Models";
import { ChatOpenAI, OpenAI, OpenAIEmbeddings } from "@langchain/openai";
import type { AIProvider, ModelParams } from "../base";
import type { ILoggingProvider } from "@shared/types/Logger";
import type { Embeddings } from "@langchain/core/embeddings";
import { LLM } from "@langchain/core/language_models/llms";

export class LMStudio implements AIProvider {
	codeModel: LMStudioModel | undefined;

	constructor(
		private readonly settings: Settings["providerSettings"]["LMStudio"],
		private readonly interactionSettings: InteractionSettings,
		private readonly loggingProvider: ILoggingProvider,
		private readonly embeddingSettings?: Settings["embeddingSettings"]["LMStudio"],
	) {
		if (!settings) {
			throw new Error("Unable to load LMStudio settings.");
		}

		this.codeModel = this.getCodeModel(this.settings!.codeModel);
	}

	async validateSettings(): Promise<boolean> {
		if (
			!this.settings?.modelInfoPath.trim() ||
			!this.settings?.baseUrl.trim()
		) {
			throw new Error(
				"LMStudio requires the base url and modelInfoPath configured.",
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
			throw new Error("LMStudio embeddings are not configured properly.");
		}

		return true;
	}

	public async validateModelExists(modelName: string): Promise<boolean> {
		try {
			const response = await fetch(
				new URL(this.settings?.modelInfoPath!, this.settings?.baseUrl),
			);

			if (!response.ok) {
				return false;
			}
			const models = (await response.json()) as { data: { id: string }[] };
			const model = models.data.find((m: { id: string }) => m.id === modelName);

			if (!model) {
				this.loggingProvider.logError(
					`Model ${modelName} not found in LMStudio.`,
				);
				return false;
			}

			if (response.status === 200) {
				return true;
			}
		} catch (error) {
			console.error(error);
		}

		return false;
	}

	getEmbedder(): Embeddings {
		return new OpenAIEmbeddings({
			model: this.embeddingSettings?.model,
			configuration: {
				baseURL: this.embeddingSettings?.baseUrl,
			},
		});
	}

	getLightweightModel() {
		return new OpenAI({
			model: this.embeddingSettings?.summaryModel,
			apiKey: "123",
			temperature: 0,
			maxTokens: this.interactionSettings.chatMaxTokens,
			configuration: {
				baseURL: this.embeddingSettings?.baseUrl,
			},
		});
	}

	getModel(params?: ModelParams) {
		const targetModel = params?.model ?? this.settings?.chatModel;
		return new ChatOpenAI({
			model: targetModel,
			apiKey: "123",
			temperature: 0,
			maxTokens: this.interactionSettings.chatMaxTokens,
			...(params ?? {}),
			configuration: {
				baseURL: this.settings?.baseUrl,
			},
		});
	}

	private getCodeModel(codeModel: string): OpenAIModel | undefined {
		return new LMStudioModel();
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
			this.loggingProvider.logError(
				`LMStudio code completion failed: ${error}`,
			);
		}

		return "";
	}
}
