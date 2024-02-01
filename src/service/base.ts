import * as vscode from "vscode";
import { Ollama } from "./ollama/ollama";
import { InteractionSettings, Settings } from "../types/Settings";
import { HuggingFace } from "./huggingface/huggingface";
import { AIModel } from "../types/Models";
import { loggingProvider } from "../providers/loggingProvider";
import { OpenAI } from "./openai/openai";

export function GetInteractionSettings(): InteractionSettings {
	const config = vscode.workspace.getConfiguration("Wingman");

	const interactionSettings = config.get<Settings["interactionSettings"]>(
		"InteractionSettings"
	)!;

	if (interactionSettings) {
		return interactionSettings;
	}

	return {
		codeContextWindow: 256,
		codeMaxTokens: -1,
		chatContextWindow: 4096,
		chatMaxTokens: 4096,
	};
}

export function GetProviderFromSettings(): AIProvider {
	const config = vscode.workspace.getConfiguration("Wingman");

	const aiProvider = config
		.get<Settings["aiProvider"]>("Provider")
		?.toLocaleLowerCase()
		.trim();

	loggingProvider.logInfo(`AI Provider: ${aiProvider} found.`);

	if (aiProvider === "huggingface") {
		return new HuggingFace();
	} else if (aiProvider === "openai") {
		return new OpenAI();
	}

	return new Ollama();
}

export interface AIProvider {
	chatModel: AIModel | undefined;
	codeModel: AIModel | undefined;
	clearChatHistory(): void;
	codeComplete(
		beginning: string,
		ending: string,
		signal: AbortSignal
	): Promise<string>;
	chat(
		prompt: string,
		ragContent: string,
		signal: AbortSignal
	): AsyncGenerator<string>;
}
