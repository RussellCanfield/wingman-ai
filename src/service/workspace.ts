import { Thread, WorkspaceSettings } from "@shared/types/Settings";
import { ExtensionContext } from "vscode";
import { v4 as uuidv4 } from 'uuid';
import { ComposerMessage } from "@shared/types/v2/Composer";

const defaultSettings: WorkspaceSettings = {
	indexerSettings: {
		indexFilter: "src/**/*.{js,jsx,ts,tsx}",
	},
	threads: [],
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

	getSettings() {
		return this.settings;
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

			// Initialize threads array if it doesn't exist
			if (!this.settings.threads) {
				this.settings.threads = [];
			}
		} catch (error) {
			console.error("Error loading workspace settings:", error);
			this.settings = defaultSettings;
		}
		return this.settings;
	}

	// Thread management methods
	async createThread(title: string = "New Thread", messages: ComposerMessage[] = []): Promise<Thread> {
		const timestamp = Date.now();
		const newThread: Thread = {
			id: uuidv4(),
			title,
			createdAt: timestamp,
			updatedAt: timestamp,
			messages,
		};

		const threads = [...(this.settings.threads || []), newThread];
		await this.save({
			threads,
			activeThreadId: newThread.id
		});

		return newThread;
	}

	async updateThread(threadId: string, updates: Partial<Thread>): Promise<Thread | null> {
		const threads = [...(this.settings.threads || [])];
		const threadIndex = threads.findIndex(t => t.id === threadId);

		if (threadIndex === -1) {
			return null;
		}

		const updatedThread = {
			...threads[threadIndex],
			...updates,
			updatedAt: Date.now()
		};

		threads[threadIndex] = updatedThread;
		await this.save({ threads });

		return updatedThread;
	}

	async deleteThread(threadId: string): Promise<boolean> {
		const threads = [...(this.settings.threads || [])];
		const threadIndex = threads.findIndex(t => t.id === threadId);

		if (threadIndex === -1) {
			return false;
		}

		threads.splice(threadIndex, 1);

		// If we're deleting the active thread, set activeThreadId to the first available thread or undefined
		let activeThreadId = this.settings.activeThreadId;
		if (activeThreadId === threadId) {
			activeThreadId = threads.length > 0 ? threads[0].id : undefined;
		}

		await this.save({
			threads,
			activeThreadId
		});

		return true;
	}

	async switchThread(threadId: string): Promise<Thread | null> {
		const threads = this.settings.threads || [];
		const thread = threads.find(t => t.id === threadId);

		if (!thread) {
			return null;
		}

		await this.save({ activeThreadId: threadId });
		return thread;
	}

	async getActiveThread(): Promise<Thread | null> {
		const { activeThreadId, threads } = this.settings;

		if (!activeThreadId || !threads || threads.length === 0) {
			return null;
		}

		return threads.find(t => t.id === activeThreadId) || null;
	}

	async getAllThreads(): Promise<Thread[]> {
		return this.settings.threads || [];
	}

	async getThreadById(threadId: string): Promise<Thread | null> {
		const threads = this.settings.threads || [];
		return threads.find(t => t.id === threadId) || null;
	}

	async addMessageToThread(threadId: string, message: any): Promise<boolean> {
		const threads = [...(this.settings.threads || [])];
		const threadIndex = threads.findIndex(t => t.id === threadId);

		if (threadIndex === -1) {
			return false;
		}

		const thread = threads[threadIndex];
		const updatedThread = {
			...thread,
			messages: [...thread.messages, message],
			updatedAt: Date.now()
		};

		threads[threadIndex] = updatedThread;
		await this.save({ threads });

		return true;
	}
}