import * as vscode from "vscode";
import {
	defaultAnthropicSettings,
	defaultAzureAIEmbeddingSettings,
	defaultAzureAISettings,
	defaultHfSettings,
	defaultInteractionSettings,
	defaultOllamaEmbeddingSettings,
	defaultOllamaSettings,
	defaultOpenAIEmbeddingSettings,
	defaultOpenAISettings,
	defaultValidationSettings,
	Settings,
} from "@shared/types/Settings";
import { homedir } from "node:os";
import { loggingProvider } from "../providers/loggingProvider";

export const defaultSettings: Settings = {
	aiProvider: "OpenAI",
	embeddingProvider: "OpenAI",
	interactionSettings: defaultInteractionSettings,
	embeddingSettings: {
		Ollama: defaultOllamaEmbeddingSettings,
		OpenAI: defaultOpenAIEmbeddingSettings,
		AzureAI: defaultAzureAIEmbeddingSettings,
	},
	providerSettings: {
		Ollama: defaultOllamaSettings,
		HuggingFace: defaultHfSettings,
		Anthropic: defaultAnthropicSettings,
		OpenAI: defaultOpenAISettings,
		AzureAI: defaultAzureAISettings,
	},
	validationSettings: defaultValidationSettings,
};

function mergeSettings(
	defaults: Settings,
	loaded: Partial<Settings>
): Settings {
	return {
		...defaults,
		...loaded,
		interactionSettings: {
			...defaults.interactionSettings,
			...loaded.interactionSettings,
		},
		embeddingSettings: {
			...defaults.embeddingSettings,
			...loaded.embeddingSettings,
		},
		providerSettings: {
			...defaults.providerSettings,
			...loaded.providerSettings,
		},
		validationSettings: {
			...defaults.validationSettings,
			...loaded.validationSettings,
		},
	};
}

export async function SaveSettings(settings: Settings) {
	await vscode.workspace.fs.writeFile(
		vscode.Uri.file(homedir() + "/.wingman/settings.json"),
		Buffer.from(JSON.stringify(settings, null, 2))
	);
	await vscode.commands.executeCommand("workbench.action.reloadWindow");
}

export async function LoadSettings(): Promise<Settings> {
	let settings: Settings;

	try {
		const fileContents = await vscode.workspace.fs.readFile(
			vscode.Uri.file(homedir() + "/.wingman/settings.json")
		);
		const loadedSettings = JSON.parse(fileContents.toString());
		settings = mergeSettings(defaultSettings, loadedSettings);
	} catch (e) {
		if (e instanceof Error) {
			loggingProvider.logError(
				`Settings file not found or corrupt, creating a new one. Error - ${e.message}`
			);
		}

		settings = { ...defaultSettings };
	}

	return settings;
}
