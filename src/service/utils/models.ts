import { HuggingFace } from "../huggingface/huggingface";
import { Anthropic } from "../anthropic/anthropic";
import { OpenAI } from "../openai/openai";
import { Ollama } from "../ollama/ollama";
import { InteractionSettings } from "@shared/types/Settings";
import { AIProvider } from "../base";

export function CreateAIProvider(
	aiProvider: string | undefined,
	config: any,
	interactionSettings: InteractionSettings
): AIProvider {
	if (aiProvider === "huggingface") {
		return new HuggingFace(config, interactionSettings);
	} else if (aiProvider === "openai") {
		return new OpenAI(config, interactionSettings);
	} else if (aiProvider === "anthropic") {
		return new Anthropic(config, interactionSettings);
	}

	return new Ollama(config, interactionSettings);
}
