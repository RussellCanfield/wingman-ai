import { WorkspaceSettings } from "@shared/types/Settings";
import { ExtensionContext } from "vscode";

const defaultSettings: WorkspaceSettings = {
	indexerSettings: {
		indexFilter: "src/**/*.{js,jsx,ts,tsx}",
	},
	chatMessages: [],
};

export class Workspace {
	private settings: WorkspaceSettings;

	constructor(
		private readonly context: ExtensionContext,
		public readonly workspaceFolder: string,
		public readonly workspacePath: string
	) {
		// Initialize settings with default values
		this.settings = defaultSettings;
	}

	async save(data: Partial<WorkspaceSettings>) {
		this.settings = {
			...this.settings,
			...data,
		};
		try {
			await this.context.workspaceState.update("settings", this.settings);
		} catch (error) {
			console.error("Error saving workspace settings:", error);
		}
	}

	async load() {
		try {
			this.settings =
				(await this.context.workspaceState.get<WorkspaceSettings>(
					"settings"
				)) ?? defaultSettings;
		} catch (error) {
			console.error("Error loading workspace settings:", error);
			this.settings = defaultSettings;
		}
		return this.settings;
	}
}
