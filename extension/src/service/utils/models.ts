import { HuggingFace } from "../huggingface/huggingface";
import { Anthropic } from "../anthropic";
import { OpenAI } from "../openai";
import { Ollama } from "../ollama";
import type { Settings } from "@shared/types/Settings";
import type { AIProvider } from "../base";
import type { ILoggingProvider } from "@shared/types/Logger";
import { AzureAI } from "../azure";
import { xAI } from "../xai";
import { OpenRouter } from "../openrouter";
import { Google } from "../google";
import { LMStudio } from "../lmstudio";

export function CreateAIProvider(
	settings: Settings,
	loggingProvider: ILoggingProvider,
): AIProvider {
	if (settings.aiProvider === "HuggingFace") {
		return new HuggingFace(
			settings.providerSettings.HuggingFace,
			settings.interactionSettings,
			loggingProvider,
		);
	}

	if (settings.aiProvider === "OpenAI") {
		return new OpenAI(
			settings.providerSettings.OpenAI,
			settings.interactionSettings,
			loggingProvider,
		);
	}

	if (settings.aiProvider === "Anthropic") {
		return new Anthropic(
			settings.providerSettings.Anthropic,
			settings.interactionSettings,
			loggingProvider,
		);
	}

	if (settings.aiProvider === "AzureAI") {
		return new AzureAI(
			settings.providerSettings.AzureAI,
			settings.interactionSettings,
			loggingProvider,
		);
	}

	if (settings.aiProvider === "xAI") {
		return new xAI(
			settings.providerSettings.xAI,
			settings.interactionSettings,
			loggingProvider,
		);
	}

	if (settings.aiProvider === "OpenRouter") {
		return new OpenRouter(
			settings.providerSettings.OpenRouter,
			settings.interactionSettings,
			loggingProvider,
		);
	}

	if (settings.aiProvider === "Google") {
		return new Google(
			settings.providerSettings.Google,
			settings.interactionSettings,
			loggingProvider,
		);
	}

	if (settings.aiProvider === "LMStudio") {
		return new LMStudio(
			settings.providerSettings.LMStudio,
			settings.interactionSettings,
			loggingProvider,
		);
	}

	return new Ollama(
		settings.providerSettings.Ollama,
		settings.interactionSettings,
		loggingProvider,
		settings.embeddingSettings.Ollama,
	);
}

export function CreateEmbeddingProvider(
	settings: Settings,
	loggingProvider: ILoggingProvider,
): AIProvider {
	if (settings.embeddingProvider === "OpenAI") {
		return new OpenAI(
			settings.providerSettings.OpenAI,
			settings.interactionSettings,
			loggingProvider,
			settings.embeddingSettings.OpenAI,
		);
	}

	if (settings.embeddingProvider === "AzureAI") {
		return new AzureAI(
			settings.providerSettings.AzureAI,
			settings.interactionSettings,
			loggingProvider,
			settings.embeddingSettings.AzureAI,
		);
	}

	if (settings.embeddingProvider === "OpenRouter") {
		return new OpenRouter(
			settings.providerSettings.OpenRouter,
			settings.interactionSettings,
			loggingProvider,
			settings.embeddingSettings.OpenRouter,
		);
	}

	if (settings.embeddingProvider === "Google") {
		return new Google(
			settings.providerSettings.Google,
			settings.interactionSettings,
			loggingProvider,
			settings.embeddingSettings.Google,
		);
	}

	if (settings.embeddingProvider === "LMStudio") {
		return new LMStudio(
			settings.providerSettings.LMStudio,
			settings.interactionSettings,
			loggingProvider,
			settings.embeddingSettings.LMStudio,
		);
	}

	return new Ollama(
		settings.providerSettings.Ollama,
		settings.interactionSettings,
		loggingProvider,
		settings.embeddingSettings.Ollama,
	);
}
