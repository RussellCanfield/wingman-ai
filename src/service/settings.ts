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
import { promises } from "node:fs";
import path from "node:path";

export const defaultSettings: Settings = {
	aiProvider: "Anthropic",
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

export class WingmanSettings {
	private settings?: Settings;
	private path: string;
	private onSettingsChanged?: (settings: Settings) => void | Promise<void>;
	isDefault = false;

	constructor() {
		this.path = path.join(homedir(), "/.wingman/settings.json");
		this.LoadSettings();
	}

	private mergeSettings(
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

	registerOnChangeHandler(
		handler: (settings: Settings) => void | Promise<void>,
	) {
		this.onSettingsChanged = handler;
	}

	async SaveSettings(settings: Settings) {
		this.isDefault = false;
		await promises.writeFile(
			path.join(homedir(), "/.wingman/settings.json"),
			Buffer.from(JSON.stringify(settings, null, 2)),
		);
		this.settings = settings;

		if (this.onSettingsChanged) {
			this.onSettingsChanged(this.settings);
		}
	}

	async LoadSettings(force = false): Promise<Settings> {
		if (this.settings && !force) return this.settings;

		try {
			const fileContents = (await promises.readFile(this.path)).toString();
			const loadedSettings = JSON.parse(fileContents.toString());
			this.settings = this.mergeSettings(defaultSettings, loadedSettings);
		} catch (e) {
			if (e instanceof Error) {
				console.error(
					`Settings file not found or corrupt, creating a new one. Error - ${e.message}`,
				);
			}

			this.settings = { ...defaultSettings };
			this.isDefault = true;
		}

		return this.settings;
	}
}

export const wingmanSettings = new WingmanSettings();
