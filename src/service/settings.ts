import { defaultSettings, type Settings } from "@shared/types/Settings";
import { homedir } from "node:os";
import fs, { promises } from "node:fs";
import path from "node:path";

export class WingmanSettings {
	private settings?: Settings;
	private path: string;
	private onSettingsChanged?: (settings: Settings) => void | Promise<void>;
	isDefault = false;

	constructor() {
		this.path = path.join(homedir(), "/.wingman/settings.json");
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
			agentSettings: {
				...defaults.agentSettings,
				...loaded.agentSettings,
			},
		};
	}

	registerOnChangeHandler(
		handler: (settings: Settings) => void | Promise<void>,
	) {
		this.onSettingsChanged = handler;
	}

	async saveSettings(settings: Settings) {
		this.isDefault = false;

		await promises.mkdir(path.dirname(this.path), { recursive: true });

		await promises.writeFile(
			this.path,
			Buffer.from(JSON.stringify(settings, null, 2)),
		);

		this.settings = settings;

		if (this.onSettingsChanged) {
			this.onSettingsChanged(this.settings);
		}
	}

	async loadSettings(force = false): Promise<Settings> {
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

		if (!this.settings.embeddingSettings.General) {
			this.settings.embeddingSettings.General = {
				...defaultSettings.embeddingSettings.General,
			};
		}

		return this.settings;
	}
}

export const wingmanSettings = new WingmanSettings();
