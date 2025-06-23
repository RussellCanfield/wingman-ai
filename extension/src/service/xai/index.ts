import type { InteractionSettings, Settings } from "@shared/types/Settings";
import type { AIProvider, ModelParams } from "../base";
import type { ILoggingProvider } from "@shared/types/Logger";
import type { AzureAIModel } from "@shared/types/Models";
import type { BaseChatModel } from "@langchain/core/language_models/chat_models";
import { type BaseMessageChunk, HumanMessage } from "@langchain/core/messages";
import { ChatXAI } from "@langchain/xai";
import { GrokModel } from "./models/grokmodel";
import type { Embeddings } from "@langchain/core/embeddings";

export class xAI implements AIProvider {
	codeModel: GrokModel | undefined;

	constructor(
		private readonly settings: Settings["providerSettings"]["xAI"],
		private readonly interactionSettings: InteractionSettings,
		private readonly loggingProvider: ILoggingProvider,
	) {
		if (!settings) {
			throw new Error("Unable to load xAI settings.");
		}

		this.codeModel = this.getCodeModel(this.settings.codeModel);
	}

	getLightweightModel() {
		return new ChatXAI({
			apiKey: this.settings?.apiKey,
			model: this.settings?.chatModel,
		});
	}

	getEmbedder(): Embeddings {
		throw new Error("Not supported.");
	}

	getModel(params?: ModelParams): BaseChatModel {
		const targetModel = params?.model ?? this.settings?.chatModel;

		return new ChatXAI({
			apiKey: this.settings?.apiKey,
			model: targetModel,
			...(params ?? {}),
		});
	}

	validateSettings(): Promise<boolean> {
		if (!this.settings?.apiKey.trim()) {
			throw new Error("xAI API key is required.");
		}

		const isChatModelValid =
			this.settings?.chatModel?.startsWith("grok") || false;
		const isCodeModelValid =
			this.settings?.codeModel?.startsWith("grok") || false;
		return Promise.resolve(isChatModelValid && isCodeModelValid);
	}

	private getCodeModel(codeModel: string): AzureAIModel | undefined {
		switch (true) {
			case codeModel.startsWith("grok"):
				return new GrokModel();
		}
	}

	async codeComplete(
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
		).replace("{ending}", ending);

		let response: BaseMessageChunk | undefined;
		try {
			response = await this.getModel({
				temperature: 0.2,
				model: this.settings?.codeModel,
			})!.invoke(
				[
					new HumanMessage({
						content: prompt.replace(
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
						),
					}),
				],
				{
					signal,
				},
			);
		} catch (error) {
			if (error instanceof Error) {
				this.loggingProvider.logError(`Code Complete failed: ${error.message}`);
			}
			return "";
		}

		const endTime = new Date().getTime();
		const executionTime = (endTime - startTime) / 1000;

		this.loggingProvider.logInfo(
			`Code Complete To First Token execution time: ${executionTime} ms`,
		);

		return response.content.toString();
	}
}
