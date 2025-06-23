import * as vscode from "vscode";
import * as fs from "node:fs";
import * as path from "node:path";
import type { LSPClient } from "../client";
import ignore, { type Ignore } from "ignore";
import type { IndexFile } from "@shared/types/Settings";
import { minimatch } from "minimatch";

export class WingmanFileWatcher {
	private fileIndex: Map<string, IndexFile> = new Map();
	private indexingQueue: Set<string> = new Set();
	private isProcessingQueue = false;
	private debounceTimers: Map<string, NodeJS.Timeout> = new Map();
	private fileWatcher: vscode.FileSystemWatcher | undefined;
	private readonly debounceTimeMs = 800; // Time to wait before indexing a changed file
	private gitHeadWatcher: vscode.FileSystemWatcher | undefined;
	private isReindexing = false;
	private branchSwitchDebounceTimer: NodeJS.Timeout | undefined;
	private inclusionFilter: string | undefined;
	private gitignoreMap: Map<string, Ignore> = new Map();
	private gitignoreWatcher: vscode.FileSystemWatcher | undefined;
	private progressTask: vscode.CancellationTokenSource | null = null;

	// Default ignore patterns to use if no .gitignore is found
	private readonly defaultIgnorePatterns = [
		// JavaScript/Node.js patterns
		"**/node_modules/**",
		"**/dist/**",
		"**/build/**",
		"**/.git/**",
		"**/coverage/**",
		"**/.next/**",
		"**/.DS_Store",
		"**/tmp/**",
		"**/logs/**",
		"**/*.min.js",
		"**/*.bundle.js",
		"**/*.map",
		"**/package-lock.json",
		"**/yarn.lock",

		// Python patterns
		"**/__pycache__/**",
		"**/*.pyc",
		"**/*.pyo",
		"**/.venv/**",
		"**/venv/**",
		"**/.env",
		"**/.python-version",
		"**/*.egg-info/**",
		"**/.pytest_cache/**",
		"**/.coverage",
		"**/htmlcov/**",
		"**/notebooks/.ipynb_checkpoints/**",

		// .NET patterns
		"**/bin/**",
		"**/obj/**",
		"**/*.dll",
		"**/*.exe",
		"**/*.pdb",
		"**/packages/**",
		"**/*.user",
		"**/*.suo",
		"**/TestResults/**",
		"**/.vs/**",
		"**/Debug/**",
		"**/Release/**",
		"**/*.nupkg",

		// Add common binary and non-code file extensions
		"**/*.png",
		"**/*.jpg",
		"**/*.jpeg",
		"**/*.gif",
		"**/*.ico",
		"**/*.svg",
		"**/*.pdf",
		"**/*.zip",
		"**/*.gz",
		"**/*.tar",
		"**/*.rar",
		"**/*.mp3",
		"**/*.mp4",
		"**/*.avi",
		"**/*.mov",
		"**/*.wav",
		"**/*.ttf",
		"**/*.woff",
		"**/*.woff2",
		"**/*.eot",
		"**/*.so",
		"**/*.o",
		"**/*.a",
		"**/*.lib",
		"**/*.dll",
		"**/*.dylib",
		"**/*.class",
		"**/*.pdb",
		"**/*.cache",
		"**/*.tiff",
		"**/*.bmp",
		"**/*.webp",
		"**/*.psd",
		"**/*.min.css",
		"**/*.min.js",
		"**/*.lock",
		"**/LICENSE",
		"**/LICENSE.*",
		"**/*.md",
		"**/*.markdown",
		"**/*.log",
		"**/*.glb",
	];

	constructor(private readonly lspClient: LSPClient) {}

	dispose() {
		if (this.fileWatcher) {
			this.fileWatcher.dispose();
		}
		if (this.gitignoreWatcher) {
			this.gitignoreWatcher.dispose();
		}
		if (this.gitHeadWatcher) {
			this.gitHeadWatcher.dispose();
		}
		// Cancel any ongoing progress
		if (this.progressTask) {
			this.progressTask.cancel();
			this.progressTask = null;
		}
	}

	/**
	 * Set up file system watchers to track file changes
	 */
	public setupFileWatchers(): vscode.FileSystemWatcher {
		this.fileWatcher = vscode.workspace.createFileSystemWatcher("**/*");

		// Handle file creation
		this.fileWatcher.onDidCreate((uri) => {
			this.queueFileForIndexing(uri.fsPath);
		});

		// Handle file changes
		this.fileWatcher.onDidChange((uri) => {
			this.debounceFileIndexing(uri.fsPath);
		});

		// Handle file deletion
		this.fileWatcher.onDidDelete((uri) => {
			this.removeFileFromIndex(uri.fsPath);
		});

		return this.fileWatcher;
	}

	/**
	 * Set up watchers for .gitignore files
	 */
	private setupGitignoreWatchers(): void {
		this.gitignoreWatcher =
			vscode.workspace.createFileSystemWatcher("**/.gitignore");

		// When a .gitignore file is created or changed
		this.gitignoreWatcher.onDidCreate((uri) => {
			this.updateGitignoreForFolder(path.dirname(uri.fsPath));
		});

		this.gitignoreWatcher.onDidChange((uri) => {
			this.updateGitignoreForFolder(path.dirname(uri.fsPath));
		});

		this.gitignoreWatcher.onDidDelete((uri) => {
			// When a .gitignore is deleted, remove it from our map
			const folderPath = path.dirname(uri.fsPath);
			this.gitignoreMap.delete(folderPath);

			// Use default patterns for this folder
			const defaultIgnore = ignore().add(this.defaultIgnorePatterns);
			this.gitignoreMap.set(folderPath, defaultIgnore);
		});
	}

	/**
	 * Read and parse a .gitignore file for a specific folder
	 */
	private updateGitignoreForFolder(folderPath: string): void {
		try {
			const gitignorePath = path.join(folderPath, ".gitignore");
			if (fs.existsSync(gitignorePath)) {
				const gitignoreContent = fs.readFileSync(gitignorePath, "utf8");
				const ignoreInstance = ignore().add(this.defaultIgnorePatterns);

				// Add patterns from the .gitignore file
				ignoreInstance.add(gitignoreContent);

				// Store the ignore instance for this folder
				this.gitignoreMap.set(folderPath, ignoreInstance);

				console.log(`Updated .gitignore patterns for ${folderPath}`);
			}
		} catch (error) {
			console.error(`Error reading .gitignore for ${folderPath}:`, error);

			// On error, use default patterns
			const defaultIgnore = ignore().add(this.defaultIgnorePatterns);
			this.gitignoreMap.set(folderPath, defaultIgnore);
		}
	}

	/**
	 * Find and load all .gitignore files in the workspace
	 */
	private async loadAllGitignoreFiles(): Promise<void> {
		const workspaceFolders = vscode.workspace.workspaceFolders;
		if (!workspaceFolders) return;

		// Clear existing gitignore cache
		this.gitignoreMap.clear();

		for (const folder of workspaceFolders) {
			// Start with root folder's .gitignore
			this.updateGitignoreForFolder(folder.uri.fsPath);

			// Find all .gitignore files in this workspace folder
			const pattern = new vscode.RelativePattern(folder, "**/.gitignore");
			const gitignoreFiles = await vscode.workspace.findFiles(pattern);

			// Load each .gitignore file
			for (const file of gitignoreFiles) {
				const containingFolder = path.dirname(file.fsPath);
				this.updateGitignoreForFolder(containingFolder);
			}
		}
	}

	/**
	 * Get the appropriate ignore instance for a file path
	 */
	private getIgnoreInstanceForFile(filePath: string): Ignore | null {
		const workspaceFolders = vscode.workspace.workspaceFolders;
		if (!workspaceFolders) return null;

		// Find the workspace folder containing this file
		let folderPath: string | null = null;
		for (const folder of workspaceFolders) {
			const wsPath = folder.uri.fsPath;
			if (filePath.startsWith(wsPath)) {
				folderPath = wsPath;
				break;
			}
		}

		if (!folderPath) return null;

		// Find the nearest parent folder with a gitignore entry
		let currentDir = path.dirname(filePath);
		while (currentDir.startsWith(folderPath)) {
			if (this.gitignoreMap.has(currentDir)) {
				return this.gitignoreMap.get(currentDir) || null;
			}
			// Move up to parent directory
			const parentDir = path.dirname(currentDir);
			if (parentDir === currentDir) break; // We've reached the root
			currentDir = parentDir;
		}

		// If no specific .gitignore found, use workspace root's ignore rules
		return this.gitignoreMap.get(folderPath) || null;
	}

	/**
	 * Check if a file should be ignored based on inclusion filter pattern and gitignore rules
	 */
	private shouldIgnoreFile(filePath: string): boolean {
		// Find the workspace root containing this file
		const workspaceFolders = vscode.workspace.workspaceFolders;
		if (!workspaceFolders) return false;

		let matchingFolder: string | null = null;
		let relativePath: string = filePath;

		for (const folder of workspaceFolders) {
			const folderPath = folder.uri.fsPath;
			if (filePath.startsWith(folderPath)) {
				matchingFolder = folderPath;
				relativePath = path.relative(folderPath, filePath);
				break;
			}
		}

		if (!matchingFolder) return false;

		// First, check if the file should be included based on the inclusion filter
		if (this.inclusionFilter && this.inclusionFilter.trim() !== "") {
			// If an inclusion filter is specified, only include files that match it
			const shouldInclude = minimatch(relativePath, this.inclusionFilter);
			if (!shouldInclude) {
				return true; // Ignore files that don't match the inclusion filter
			}
		}

		// Then, check gitignore rules
		const ignoreInstance = this.getIgnoreInstanceForFile(filePath);
		if (ignoreInstance) {
			return ignoreInstance.ignores(relativePath);
		}

		// If no ignore rules found, use default patterns
		return false;
	}

	/**
	 * Debounces file indexing to prevent excessive processing
	 */
	private debounceFileIndexing(filePath: string): void {
		// Clear existing timer if any
		if (this.debounceTimers.has(filePath)) {
			clearTimeout(this.debounceTimers.get(filePath));
		}

		// Set a new timer
		const timer = setTimeout(() => {
			this.queueFileForIndexing(filePath);
			this.debounceTimers.delete(filePath);
		}, this.debounceTimeMs);

		this.debounceTimers.set(filePath, timer);
	}

	/**
	 * Add a file to the indexing queue and start processing if not already in progress
	 */
	private queueFileForIndexing(filePath: string): void {
		if (!this.shouldIndexFile(filePath)) return;

		this.indexingQueue.add(filePath);

		if (!this.isProcessingQueue) {
			this.processIndexingQueue();
		}
	}

	/**
	 * Process files in the indexing queue
	 */
	private async processIndexingQueue(): Promise<void> {
		if (this.indexingQueue.size === 0) {
			this.isProcessingQueue = false;
			return;
		}

		this.isProcessingQueue = true;

		// Process files in batches if there are many
		const targetFiles = new Map<string, IndexFile>();
		const filesToProcess = Array.from(this.indexingQueue);
		this.indexingQueue.clear();

		// Update our local index for these files
		for (const filePath of filesToProcess) {
			try {
				const stats = fs.statSync(filePath);
				this.fileIndex.set(filePath, { lastModified: stats.mtime.getTime() });
				targetFiles.set(filePath, { lastModified: stats.mtime.getTime() });
			} catch (error) {
				// File might have been deleted before indexing
				console.log(`Could not update index for ${filePath}: ${error}`);
			}
		}

		// Use batch processing for larger sets
		await this.lspClient.indexFiles(targetFiles);

		// Continue processing if more files were added during processing
		setImmediate(() => this.processIndexingQueue());
	}

	private shouldIndexFile(filePath: string): boolean {
		try {
			// Check if file exists
			if (!fs.existsSync(filePath)) return false;

			// Check gitignore and wingmanignore rules
			if (this.shouldIgnoreFile(filePath)) {
				return false;
			}

			// Skip directories
			const stats = fs.statSync(filePath);
			if (stats.isDirectory()) return false;

			// Skip files that are too large (> 1MB)
			if (stats.size > 1024 * 1024) return false;

			// Skip if file hasn't changed since last indexing
			return this.hasFileChanged(filePath);
		} catch (error) {
			console.error(`Error checking file ${filePath}:`, error);
			return false;
		}
	}

	/**
	 * Remove a file from the index
	 */
	private removeFileFromIndex(filePath: string): void {
		this.fileIndex.delete(filePath);
		// Notify LSP client that file was removed
		this.lspClient.removeFileFromIndex(filePath);
		console.log(`File removed from index: ${filePath}`);
	}

	/**
	 * Check if a file has changed since last indexing
	 */
	private hasFileChanged(filePath: string): boolean {
		try {
			const indexed = this.fileIndex.get(filePath);
			if (!indexed) return true;

			const stats = fs.statSync(filePath);
			return stats.mtime.getTime() > indexed.lastModified;
		} catch (error) {
			// File might have been deleted
			return false;
		}
	}

	/**
	 * Set up workspace watcher for folder changes
	 */
	public setupWorkspaceWatcher(): void {
		vscode.workspace.onDidChangeWorkspaceFolders(async (event) => {
			// Index new folders
			for (const folder of event.added) {
				// Load gitignore files for the new folder
				this.updateGitignoreForFolder(folder.uri.fsPath);
				this.queueFolderForIndexing(folder.uri.fsPath);
			}

			// Remove files and patterns from removed folders
			for (const folder of event.removed) {
				const prefix = folder.uri.fsPath;
				// Remove gitignore entries for this folder
				this.gitignoreMap.delete(prefix);

				// Remove all files that begin with this path
				for (const filePath of Array.from(this.fileIndex.keys())) {
					if (filePath.startsWith(prefix)) {
						this.removeFileFromIndex(filePath);
					}
				}
			}
		});

		this.setupGitBranchWatcher();
	}

	/**
	 * Set up a watcher for Git branch switches
	 */
	private setupGitBranchWatcher(): void {
		const workspaceFolders = vscode.workspace.workspaceFolders;
		if (!workspaceFolders) return;

		// For each workspace folder, watch its .git/HEAD file
		for (const folder of workspaceFolders) {
			try {
				const gitHeadPath = path.join(folder.uri.fsPath, ".git", "HEAD");

				// Check if the .git directory exists
				if (fs.existsSync(path.dirname(gitHeadPath))) {
					this.gitHeadWatcher =
						vscode.workspace.createFileSystemWatcher(gitHeadPath);

					// When HEAD changes (branch switch occurs)
					this.gitHeadWatcher.onDidChange(() => {
						this.handleGitBranchSwitch(folder.uri.fsPath);
					});

					console.log(`Git branch watcher set up for ${folder.name}`);
				}
			} catch (error) {
				console.error(
					`Failed to set up Git branch watcher for ${folder.name}:`,
					error,
				);
			}
		}
	}

	/**
	 * Handle a Git branch switch by re-indexing the workspace
	 */
	private handleGitBranchSwitch(folderPath: string): void {
		// Clear any existing debounce timer
		if (this.branchSwitchDebounceTimer) {
			clearTimeout(this.branchSwitchDebounceTimer);
		}

		// Debounce to avoid multiple re-indexing if HEAD changes multiple times quickly
		this.branchSwitchDebounceTimer = setTimeout(() => {
			if (this.isReindexing) return;

			console.log(
				`Git branch switch detected in ${folderPath}, re-indexing...`,
			);

			// Display notification to user
			vscode.window.showInformationMessage(
				"Git branch switched - Wingman is re-indexing your files",
			);

			// Clear existing file index for this folder
			this.clearFolderFromIndex(folderPath);

			// Re-read gitignore files as they might have changed
			this.updateGitignoreForFolder(folderPath);

			// Re-index the folder
			this.queueFolderForIndexing(folderPath);
		}, 2000); // Reduced from 10s to 2s for faster response
	}

	/**
	 * Clear all indexed files for a specific folder
	 */
	private clearFolderFromIndex(folderPath: string): void {
		// Remove files from the index
		for (const filePath of Array.from(this.fileIndex.keys())) {
			if (filePath.startsWith(folderPath)) {
				this.removeFileFromIndex(filePath);
			}
		}

		// Clear indexing queue for this folder
		this.indexingQueue = new Set(
			Array.from(this.indexingQueue).filter(
				(file) => !file.startsWith(folderPath),
			),
		);
	}

	/**
	 * Add a command to manually trigger re-indexing
	 */
	public async reindexWorkspace(): Promise<void> {
		if (this.isReindexing) return;

		this.isReindexing = true;
		try {
			const workspaceFolders = vscode.workspace.workspaceFolders;
			if (!workspaceFolders) return;

			console.log("Manually re-indexing workspace...");

			// Reload all gitignore files
			await this.loadAllGitignoreFiles();

			// Clear existing index and reload patterns
			for (const folder of workspaceFolders) {
				const folderPath = folder.uri.fsPath;
				this.clearFolderFromIndex(folderPath);
			}

			// Re-index the workspace
			await this.initialIndexing();

			console.log("Manual re-indexing completed");
		} finally {
			this.isReindexing = false;
		}
	}

	/**
	 * Queue a folder for indexing with non-blocking approach
	 */
	private queueFolderForIndexing(folderPath: string): void {
		// Find eligible files and queue them for indexing
		this.findEligibleFiles(folderPath).then((files) => {
			console.log(`Found ${files.length} eligible files in ${folderPath}`);

			// Queue files in smaller batches to avoid overwhelming the system
			const batchSize = 50;
			for (let i = 0; i < files.length; i += batchSize) {
				const batch = files.slice(i, i + batchSize);
				for (const filePath of batch) {
					this.queueFileForIndexing(filePath);
				}
			}

			if (this.isReindexing) {
				this.isReindexing = false;
			}
		});
	}

	/**
	 * Find all eligible files recursively in a folder
	 * Uses combined .gitignore and inclusionFilter patterns
	 */
	private async findEligibleFiles(folderPath: string): Promise<string[]> {
		const result: string[] = [];

		try {
			// Use glob pattern for all files
			const pattern = new vscode.RelativePattern(folderPath, "**/*");

			// Use vscode API to find files
			const files = await vscode.workspace.findFiles(pattern);

			// Filter files based on size and ignore patterns
			for (const file of files) {
				const filePath = file.fsPath;
				try {
					// Skip directories
					const stats = fs.statSync(filePath);
					if (stats.isDirectory()) continue;

					// Skip files that are too large
					if (stats.size > 1024 * 1024) continue;

					// Skip files that match ignore patterns
					if (this.shouldIgnoreFile(filePath)) continue;

					result.push(filePath);
				} catch (error) {
					// Ignore errors for files that might have been deleted
				}
			}
		} catch (error) {
			console.error(`Error finding eligible files in ${folderPath}:`, error);
		}

		return result;
	}

	/**
	 * Initial indexing of the entire workspace with progress indication
	 */
	public async initialIndexing(): Promise<void> {
		const workspaceFolders = vscode.workspace.workspaceFolders;
		if (!workspaceFolders) return;

		// Load gitignore files (lightweight operation) first
		await this.loadAllGitignoreFiles();

		// Create a cancellation token for the progress UI
		if (this.progressTask) {
			this.progressTask.cancel();
		}
		this.progressTask = new vscode.CancellationTokenSource();

		// Show non-blocking progress
		vscode.window.withProgress(
			{
				location: vscode.ProgressLocation.Notification,
				title: "Wingman: Indexing workspace files",
				cancellable: true,
			},
			async (progress, token) => {
				token.onCancellationRequested(() => {
					console.log("User cancelled the indexing operation");
					if (this.progressTask) {
						this.progressTask.cancel();
					}
				});

				// Start indexing in a non-blocking manner
				this.startProgressiveIndexing(workspaceFolders, progress);

				// Wait until indexing is done or cancelled
				return new Promise<void>((resolve) => {
					const checkCompletionInterval = setInterval(() => {
						if (!this.isReindexing || token.isCancellationRequested) {
							clearInterval(checkCompletionInterval);
							resolve();
						}
					}, 500);
				});
			},
		);
	}

	/**
	 * Start progressive indexing without blocking the UI
	 */
	private async startProgressiveIndexing(
		workspaceFolders: readonly vscode.WorkspaceFolder[],
		progress: vscode.Progress<{ message?: string; increment?: number }>,
	): Promise<void> {
		console.log("Starting initial indexing of workspace...");
		this.isReindexing = true;

		const totalFolders = workspaceFolders.length;
		let processedFolders = 0;

		// Process each folder in the workspace
		for (const folder of workspaceFolders) {
			if (this.progressTask?.token.isCancellationRequested) {
				console.log("Indexing was cancelled");
				this.isReindexing = false;
				return;
			}

			const folderName = folder.name;
			const folderPath = folder.uri.fsPath;

			progress.report({
				message: `Scanning ${folderName} (${processedFolders + 1}/${totalFolders})`,
				increment: 100 / totalFolders,
			});

			// Queue this folder for indexing in a non-blocking way
			this.queueFolderForIndexing(folderPath);

			processedFolders++;
		}

		// Final update
		progress.report({ message: "Finishing up indexing..." });

		// Mark indexing as complete
		setTimeout(() => {
			console.log("Initial indexing completed");
			this.isReindexing = false;
		}, 1000);
	}

	/**
	 * Initialize the extension with all watchers and indexing
	 */
	public async initialize(inclusionFilter: string): Promise<void> {
		this.inclusionFilter = inclusionFilter;

		// Set up watchers for file system changes
		this.setupFileWatchers();
		this.setupGitignoreWatchers();
		this.setupWorkspaceWatcher();

		// Then do initial indexing in a non-blocking way
		await this.initialIndexing();
	}
}
