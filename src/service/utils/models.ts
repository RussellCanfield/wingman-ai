import { HuggingFace } from "../huggingface/huggingface";
import { Anthropic } from "../anthropic/anthropic";
import { OpenAI } from "../openai/openai";
import { Ollama } from "../ollama/ollama";
import { Settings } from "@shared/types/Settings";
import { AIProvider } from "../base";
import { ILoggingProvider } from "@shared/types/Logger";
import { AzureAI } from "../azure/azure";

export function CreateAIProvider(
	settings: Settings,
	loggingProvider: ILoggingProvider
): AIProvider {
	if (settings.aiProvider === "HuggingFace") {
		return new HuggingFace(
			settings.providerSettings.HuggingFace,
			settings.interactionSettings,
			loggingProvider
		);
	} else if (settings.aiProvider === "OpenAI") {
		return new OpenAI(
			settings.providerSettings.OpenAI,
			settings.interactionSettings,
			loggingProvider
		);
	} else if (settings.aiProvider === "Anthropic") {
		return new Anthropic(
			settings.providerSettings.Anthropic,
			settings.interactionSettings,
			loggingProvider
		);
	} else if (settings.aiProvider === "AzureAI") {
		return new AzureAI(
			settings.providerSettings.AzureAI,
			settings.interactionSettings,
			loggingProvider
		);
	}

	return new Ollama(
		settings.providerSettings.Ollama,
		settings.interactionSettings,
		loggingProvider
	);
}
