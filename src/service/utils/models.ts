import { HuggingFace } from "../huggingface/huggingface";
import { Anthropic } from "../anthropic/anthropic";
import { OpenAI } from "../openai/openai";
import { Ollama } from "../ollama/ollama";
import type { Settings } from "@shared/types/Settings";
import type { AIProvider } from "../base";
import type { ILoggingProvider } from "@shared/types/Logger";
import { AzureAI } from "../azure/azure";
import { xAI } from "../xai";

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

	return new Ollama(
		settings.providerSettings.Ollama,
		settings.interactionSettings,
		loggingProvider,
	);
}
