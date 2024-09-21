import { HuggingFace } from "../huggingface/huggingface";
import { Anthropic } from "../anthropic/anthropic";
import { OpenAI } from "../openai/openai";
import { Ollama } from "../ollama/ollama";
import { Settings } from "@shared/types/Settings";
import { AIProvider } from "../base";

export function CreateAIProvider(settings: Settings): AIProvider {
	if (settings.aiProvider === "HuggingFace") {
		return new HuggingFace(
			settings.providerSettings.HuggingFace,
			settings.interactionSettings
		);
	} else if (settings.aiProvider === "OpenAI") {
		return new OpenAI(
			settings.providerSettings.OpenAI,
			settings.interactionSettings
		);
	} else if (settings.aiProvider === "Anthropic") {
		return new Anthropic(
			settings.providerSettings.Anthropic,
			settings.interactionSettings
		);
	}

	return new Ollama(
		settings.providerSettings.Ollama,
		settings.interactionSettings
	);
}
