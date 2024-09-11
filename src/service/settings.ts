import * as vscode from "vscode";
import { loggingProvider } from "../providers/loggingProvider";
import {
	AiProviders,
	InteractionSettings,
	Settings,
} from "@shared/types/Settings";

export function GetAllSettings(): vscode.WorkspaceConfiguration {
	return vscode.workspace.getConfiguration("Wingman");
}

type AiProvider = (typeof AiProviders)[number];

// Create a map using the lowercase versions of the AiProviders values as keys
export const providerToSettingMap: Record<Lowercase<AiProvider>, AiProvider> = {
	ollama: "Ollama",
	huggingface: "HuggingFace",
	openai: "OpenAI",
	anthropic: "Anthropic",
};

export function GetInteractionSettings(): InteractionSettings {
	const config = vscode.workspace.getConfiguration("Wingman");

	const interactionSettings = config.get<Settings["interactionSettings"]>(
		"InteractionSettings"
	)!;

	if (interactionSettings) {
		return interactionSettings;
	}

	return {
		codeCompletionEnabled: true,
		codeStreaming: false,
		codeContextWindow: 256,
		codeMaxTokens: -1,
		chatContextWindow: 4096,
		chatMaxTokens: 4096,
	};
}

export function GetSettings() {
	const config = vscode.workspace.getConfiguration("Wingman");

	const aiProvider = config
		.get<Settings["aiProvider"]>("Provider")
		?.toLocaleLowerCase()
		.trim();

	const embeddingProvider = config
		.get<Settings["embeddingProvider"]>("EmbeddingProvider")
		?.toLocaleLowerCase()
		.trim();

	if (!aiProvider) {
		loggingProvider.logError("No AI Provider found.");
		return {
			aiProvider: undefined,
			config: undefined,
		};
	}

	loggingProvider.logInfo(`AI Provider: ${aiProvider} found.`);

	const interactionSettings = config.get<Settings["interactionSettings"]>(
		"InteractionSettings"
	)!;

	return {
		aiProvider,
		embeddingProvider,
		//@ts-expect-error
		config: config.get<Settings>(providerToSettingMap[String(aiProvider!)]),
		embeddingSettings: config.get<Settings>(
			embeddingProvider === "ollama"
				? "OllamaEmbeddingSettings"
				: "OpenAIEmbeddingSettings"
		),
		interactionSettings,
	};
}
