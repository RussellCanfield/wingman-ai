import type { AIProvider, ModelParams } from "../base";
import type { InteractionSettings, Settings } from "@shared/types/Settings";
import { SonnetModel } from "./models/sonnet";
import type { AnthropicModel } from "@shared/types/Models";
import type { BaseChatModel } from "@langchain/core/language_models/chat_models";
import { ChatAnthropic } from "@langchain/anthropic";
import type { ILoggingProvider } from "@shared/types/Logger";
import { HumanMessage, SystemMessage } from "@langchain/core/messages";
import { HaikuModel } from "./models/haiku";
import type { Embeddings } from "@langchain/core/embeddings";

const reasoningModels = ["claude-3-7-sonnet"];

export class Anthropic implements AIProvider {
	codeModel: AnthropicModel | undefined;

	constructor(
		private readonly settings: Settings["providerSettings"]["Anthropic"],
		private readonly interactionSettings: InteractionSettings,
		private readonly loggingProvider: ILoggingProvider,
	) {
		if (!settings) {
			throw new Error("Unable to load Anthropic settings.");
		}

		if (!this.settings?.apiKey || !this.settings.apiKey.trim()) {
			throw new Error("Anthropic API key is required.");
		}

		this.codeModel = this.getCodeModel(this.settings.codeModel);
	}

	async validateSettings(): Promise<boolean> {
		const isChatModelValid =
			this.settings?.chatModel?.startsWith("claude") || false;
		const isCodeModelValid =
			this.settings?.codeModel?.startsWith("claude") || false;
		return isChatModelValid && isCodeModelValid;
	}

	async validateEmbeddingSettings(): Promise<boolean> {
		return true;
	}

	getModel(params?: ModelParams): BaseChatModel {
		const targetModel = params?.model ?? this.settings?.chatModel;
		const isReasoningModel = reasoningModels.some((reasoningModel) =>
			targetModel?.startsWith(reasoningModel),
		);

		return new ChatAnthropic({
			apiKey: this.settings?.apiKey,
			anthropicApiKey: this.settings?.apiKey,
			model: targetModel,
			temperature: this.settings?.enableReasoning ? undefined : 0,
			maxTokens: this.interactionSettings?.chatMaxTokens,
			clientOptions: {
				defaultHeaders: {
					"anthropic-beta": "prompt-caching-2024-07-31",
				},
			},
			thinking:
				this.settings?.enableReasoning && isReasoningModel
					? {
							budget_tokens: 8096,
							type: "enabled",
						}
					: undefined,
		});
	}

	getEmbedder(): Embeddings {
		throw new Error("Embeddings not supported");
	}

	getLightweightModel() {
		return new ChatAnthropic({
			apiKey: this.settings?.apiKey,
			anthropicApiKey: this.settings?.apiKey,
			model: "claude-3-5-haiku-latest",
			temperature: 0,
		});
	}

	private getCodeModel(codeModel: string): AnthropicModel | undefined {
		switch (true) {
			case codeModel.includes("sonnet"):
				return new SonnetModel();
			case codeModel.includes("haiku"):
				return new HaikuModel();
			default:
				throw new Error(
					"Invalid code model name, currently code supports Claude 3 model(s).",
				);
		}
	}

	public async codeComplete(
		beginning: string,
		ending: string,
		signal: AbortSignal,
		additionalContext?: string,
		recentClipboard?: string,
	): Promise<string> {
		try {
			const response = await this.getModel({
				temperature: 0.2,
				model: this.settings?.codeModel,
			}).invoke(
				[
					new SystemMessage({
						content: this.codeModel!.CodeCompletionPrompt.replace(
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
					new HumanMessage({
						content: `${beginning}[FILL IN THE MIDDLE]${ending}`,
					}),
				],
				{ signal },
			);

			return response.content.toString();
		} catch (e) {
			if (e instanceof Error) {
				this.loggingProvider.logError(
					`Code Complete failed: ${e.message}`,
					!e.message.includes("AbortError"),
				);
			}
		}

		return "";
	}
}
