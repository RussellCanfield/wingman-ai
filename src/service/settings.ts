import * as vscode from "vscode";
import {
	defaultAnthropicSettings,
	defaultAzureAISettings,
	defaultHfSettings,
	defaultInteractionSettings,
	defaultOllamaSettings,
	defaultOpenAISettings,
	defaultValidationSettings,
	type Settings,
} from "@shared/types/Settings";
import { homedir } from "node:os";
import { loggingProvider } from "../providers/loggingProvider";

export const defaultSettings: Settings = {
	aiProvider: "OpenAI",
	interactionSettings: defaultInteractionSettings,
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
	loaded: Partial<Settings>,
): Settings {
	return {
		...defaults,
		...loaded,
		interactionSettings: {
			...defaults.interactionSettings,
			...loaded.interactionSettings,
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
	//Turn off model specific settings if needed
	if (
		settings.aiProvider === "Anthropic" &&
		settings.providerSettings.Anthropic
	) {
		if (
			!settings.providerSettings.Anthropic.chatModel.startsWith(
				"claude-3-7-sonnet",
			)
		) {
			settings.providerSettings.Anthropic.enableReasoning = false;
			settings.providerSettings.Anthropic.sparkMode = false;
		}
	}

	await vscode.workspace.fs.writeFile(
		vscode.Uri.file(`${homedir()}/.wingman/settings.json`),
		Buffer.from(JSON.stringify(settings, null, 2)),
	);
	await vscode.commands.executeCommand("workbench.action.reloadWindow");
}

export async function LoadSettings(): Promise<Settings> {
	let settings: Settings;

	try {
		const fileContents = await vscode.workspace.fs.readFile(
			vscode.Uri.file(`${homedir()}/.wingman/settings.json`),
		);
		const loadedSettings = JSON.parse(fileContents.toString());
		settings = mergeSettings(defaultSettings, loadedSettings);
	} catch (e) {
		if (e instanceof Error) {
			loggingProvider.logError(
				`Settings file not found or corrupt, creating a new one. Error - ${e.message}`,
			);
		}

		settings = { ...defaultSettings };
	}

	return settings;
}
