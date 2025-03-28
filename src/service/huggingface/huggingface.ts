import type { HuggingFaceAIModel } from "@shared/types/Models";
import type { InteractionSettings, Settings } from "@shared/types/Settings";
import type { AIProvider, ModelParams } from "../base";
import type { ILoggingProvider } from "@shared/types/Logger";
import type { Embeddings } from "@langchain/core/embeddings";
import { GenericModel } from "./models/generic";
import { HuggingFaceInference } from "@langchain/community/llms/hf";

export class HuggingFace implements AIProvider {
	codeModel: HuggingFaceAIModel | undefined;

	constructor(
		private readonly settings: Settings["providerSettings"]["HuggingFace"],
		private readonly interactionSettings: InteractionSettings,
		private readonly loggingProvider: ILoggingProvider,
	) {
		if (!settings) {
			throw new Error("Unable to log HuggingFace configuration.");
		}

		if (!this.settings?.apiKey.trim()) {
			throw new Error("Hugging Face API key is required.");
		}

		this.codeModel = this.getCodeModel(this.settings.codeModel);
	}

	getEmbedder(): Embeddings {
		throw new Error("Not Implemented");
	}

	async validateSettings(): Promise<boolean> {
		return true;
	}

	getModel(params?: ModelParams) {
		return new HuggingFaceInference({
			model: this.settings?.chatModel,
			apiKey: this.settings?.apiKey,
			...(params ?? {}),
		});
	}

	getLightweightModel() {
		return new HuggingFaceInference({
			model: this.settings?.chatModel,
			apiKey: this.settings?.apiKey,
		});
	}

	private getCodeModel(codeModel: string): HuggingFaceAIModel | undefined {
		return new GenericModel();
	}

	public async codeComplete(
		beginning: string,
		ending: string,
		signal: AbortSignal,
		additionalContext?: string,
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

${additionalContext ?? ""}`,
			);

		this.loggingProvider.logInfo("HuggingFace - Code Completion started");

		let response: string | undefined;

		try {
			response = await this.getModel().invoke(prompt, {
				signal,
			});
		} catch (error) {
			return `HuggingFace - code completion request with model ${this.settings?.codeModel} failed with the following error: ${error}`;
		}

		const endTime = new Date().getTime();
		const executionTime = (endTime - startTime) / 1000;

		this.loggingProvider.logInfo(
			`Code Completion execution time: ${executionTime} seconds`,
		);

		return response ?? "";
	}
}
