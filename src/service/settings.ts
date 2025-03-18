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

	async SaveSettings(settings: Settings, workspace: string) {
		this.isDefault = false;
		const mcpTools = [...(settings.mcpTools ?? [])];
		settings.mcpTools = undefined;

		await promises.mkdir(path.dirname(this.path), { recursive: true });

		await promises.writeFile(
			this.path,
			Buffer.from(JSON.stringify(settings, null, 2)),
		);

		await promises.mkdir(path.join(homedir(), ".wingman", workspace), {
			recursive: true,
		});

		await promises.writeFile(
			path.join(homedir(), ".wingman", workspace, "mcpTools.json"),
			JSON.stringify(mcpTools ?? []),
		);

		this.settings = settings;

		if (this.onSettingsChanged) {
			this.onSettingsChanged(this.settings);
		}
	}

	async LoadSettings(workspace: string, force = false): Promise<Settings> {
		if (this.settings && !force) return this.settings;

		try {
			const fileContents = (await promises.readFile(this.path)).toString();
			const loadedSettings = JSON.parse(fileContents.toString());
			this.settings = this.mergeSettings(defaultSettings, loadedSettings);

			const toolsPath = path.join(
				homedir(),
				".wingman",
				workspace,
				"mcpTools.json",
			);
			if (fs.existsSync(toolsPath)) {
				const toolsContent = (await promises.readFile(toolsPath)).toString();
				const loadedTools = JSON.parse(toolsContent.toString());
				this.settings.mcpTools = loadedTools;
			} else {
				if (this.settings.mcpTools && this.settings.mcpTools.length > 0) {
					await promises.writeFile(
						path.join(homedir(), ".wingman", workspace, "mcpTools.json"),
						JSON.stringify(this.settings.mcpTools),
					);
				}
			}
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
