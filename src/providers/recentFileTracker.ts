import type { FileMetadata } from "@shared/types/Message";
import { v4 as uuidv4 } from "uuid";
import * as vscode from "vscode";

/**
 * Tracks the most recently opened files in VSCode
 */
export class RecentFileTracker {
	private static instance: RecentFileTracker;
	private recentFiles: FileMetadata[] = [];
	private readonly maxFiles: number = 10;
	private disposables: vscode.Disposable[] = [];

	private constructor() {
		// Initialize with currently open documents
		const openDocuments = vscode.workspace.textDocuments.filter(
			(d) => d.uri.scheme === "file",
		);

		// Add currently open documents to recent files
		// biome-ignore lint/complexity/noForEach: <explanation>
		openDocuments.forEach((doc) => {
			this.addFile({
				path: doc.uri.fsPath,
				id: doc.uri.toString(),
			});
		});

		// Register event listener for document opening
		this.disposables.push(
			vscode.window.onDidChangeActiveTextEditor((editor) => {
				if (editor && editor.document.uri.scheme === "file") {
					this.addFile({
						path: editor.document.uri.fsPath,
						id: uuidv4(),
					});
				}
			}),
		);
	}

	/**
	 * Gets the singleton instance of RecentFileTracker
	 */
	public static getInstance(): RecentFileTracker {
		if (!RecentFileTracker.instance) {
			RecentFileTracker.instance = new RecentFileTracker();
		}
		return RecentFileTracker.instance;
	}

	/**
	 * Adds a file to the recent files list
	 */
	private addFile(file: FileMetadata): void {
		// Remove the file if it already exists in the list
		this.recentFiles = this.recentFiles.filter((f) => f.id !== file.id);

		// Add the file to the beginning of the list
		this.recentFiles.unshift(file);

		// Trim the list to maxFiles
		if (this.recentFiles.length > this.maxFiles) {
			this.recentFiles = this.recentFiles.slice(0, this.maxFiles);
		}
	}

	/**
	 * Gets the list of recent files
	 */
	public getRecentFiles(): FileMetadata[] {
		return [...this.recentFiles];
	}

	/**
	 * Opens a file from the recent files list
	 */
	public openFile(file: FileMetadata): void {
		if (file) {
			try {
				vscode.workspace
					.openTextDocument(file.path)
					.then((doc) => vscode.window.showTextDocument(doc))
					.then(() => {
						// Move the file to the top of the list
						this.addFile(file);
					});
			} catch {}
		}
	}

	/**
	 * Disposes of all registered event listeners
	 */
	public dispose(): void {
		// biome-ignore lint/complexity/noForEach: <explanation>
		this.disposables.forEach((d) => d.dispose());
		this.disposables = [];
	}
}

// Export a convenience function to get the instance
export const getRecentFileTracker = (): RecentFileTracker => {
	return RecentFileTracker.getInstance();
};
