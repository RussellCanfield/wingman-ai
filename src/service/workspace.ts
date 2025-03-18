import type { WorkspaceSettings } from "@shared/types/Settings";
import type { ExtensionContext } from "vscode";

const defaultSettings: WorkspaceSettings = {
	threadIds: [],
	activeThreadId: undefined,
};

export class Workspace {
	private settings: WorkspaceSettings;

	constructor(
		private readonly context: ExtensionContext,
		public readonly workspaceFolder: string,
		public readonly workspacePath: string,
	) {
		// Initialize settings with default values
		this.settings = defaultSettings;
	}

	getSettings() {
		return this.settings;
	}

	async clear() {
		await this.context.workspaceState.update("settings", defaultSettings);
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
					"settings",
				)) ?? defaultSettings;

			if (!this.settings.threadIds) {
				this.settings.threadIds = [];
				this.settings.activeThreadId = undefined;
			}
		} catch (error) {
			console.error("Error loading workspace settings:", error);
			this.settings = defaultSettings;
		}
		return this.settings;
	}

	// Thread management methods
	async createThread(id: string) {
		const threadIds = [...(this.settings.threadIds ?? []), id];
		await this.save({
			threadIds,
			activeThreadId: id,
		});
	}

	async deleteThread(threadId: string): Promise<boolean> {
		const threadIds = [...(this.settings.threadIds || [])];
		const remainingThreadIds = threadIds.filter((i) => i !== threadId);

		await this.save({
			threadIds: remainingThreadIds,
		});

		return true;
	}

	async switchThread(id: string) {
		await this.save({ activeThreadId: id });
	}
}
