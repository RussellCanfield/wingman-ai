import * as vscode from "vscode";
import fs from "node:fs";
import { eventEmitter } from "../events/eventEmitter";
import type { AppMessage, CodeContextDetails } from "@shared/types/Message";
import type { AppState } from "@shared/types/Settings";
import type {
	FixDiagnosticsEvent,
	RenameThreadEvent,
	UpdateCommandEvent,
	UpdateComposerFileEvent,
} from "@shared/types/Events";
import {
	addNoneAttributeToLink,
	getActiveWorkspace,
	getNonce,
} from "./utilities";
import type { LSPClient } from "../client/index";
import type {
	ComposerRequest,
	ComposerState,
	ComposerThread,
	ComposerThreadEvent,
	DiffViewCommand,
	FileSearchResult,
} from "@shared/types/Composer";
import type { DiffViewProvider } from "./diffViewProvider";
import type { Workspace } from "../service/workspace";
import type { ConfigViewProvider } from "./configViewProvider";
import path from "node:path";
import type { FileMetadata } from "@shared/types/Message";
import type { ThreadViewProvider } from "./threadViewProvider";
import { getRecentFileTracker } from "./recentFileTracker";
import { isFileExcludedByGitignore } from "../server/files/utils";
import { wingmanSettings } from "../service/settings";
import { ImageEditorViewProvider } from "./imageEditorViewProvider";

export type ChatView = "composer" | "indexer";

export class ChatViewProvider implements vscode.WebviewViewProvider {
	public static readonly viewType = "wingman.chatview";
	public static readonly showComposerCommand = "wingmanai.opencomposer";

	private _disposables: vscode.Disposable[] = [];
	private _webview: vscode.Webview | undefined;
	private _launchView: ChatView = "composer";
	private _imageCanvas: ImageEditorViewProvider | undefined;

	constructor(
		private readonly _lspClient: LSPClient,
		private readonly _context: vscode.ExtensionContext,
		private readonly _diffViewProvider: DiffViewProvider,
		private readonly _threadViewProvider: ThreadViewProvider,
		private readonly _workspace: Workspace,
		private readonly _settingsViewProvider: ConfigViewProvider,
	) {
		this._imageCanvas = new ImageEditorViewProvider(_context, _lspClient);
	}

	dispose() {
		// biome-ignore lint/complexity/noForEach: <explanation>
		this._disposables.forEach((d) => d.dispose());
		this._disposables = [];
	}

	public setLaunchView(view: ChatView) {
		if (this._webview) {
			this.showView(view);
			return;
		}

		this._launchView = view;
	}

	showView(view: ChatView) {
		if (!view) {
			return;
		}
		this._webview?.postMessage({
			command: "switchView",
			value: view,
		});
	}

	async updateSettingsOnUI() {
		if (this._webview) {
			this._webview.postMessage({
				command: "settings",
				value: await wingmanSettings.loadSettings(),
			});
		}
	}

	public resolveWebviewView(
		webviewView: vscode.WebviewView,
		context: vscode.WebviewViewResolveContext,
		token: vscode.CancellationToken,
	) {
		this._webview = webviewView.webview;
		webviewView.webview.options = {
			enableScripts: true,
			localResourceRoots: [
				vscode.Uri.joinPath(this._context.extensionUri, "media"),
				vscode.Uri.joinPath(this._context.extensionUri, "out"),
			],
		};

		webviewView.webview.html = this.getHtmlForWebview(webviewView.webview);

		this._lspClient.setComposerWebViewReference(webviewView.webview);

		token.onCancellationRequested((e) => {
			this._lspClient.cancelComposer("");
			eventEmitter._onQueryComplete.fire();
		});

		this._disposables.push(
			webviewView.webview.onDidReceiveMessage(async (data: AppMessage) => {
				if (!data) {
					return;
				}

				const { command, value } = data;

				// TODO - move to a mediator pattern
				switch (command) {
					case "image-editor": {
						this._imageCanvas?.openEditor();
						break;
					}
					case "save-image": {
						await this.saveImage(String(value));
						break;
					}
					case "fix-diagnostics": {
						const event = value as FixDiagnosticsEvent;
						if (!event.diagnostics?.length) return;
						this._lspClient.fixDiagnostics(event);
						break;
					}
					case "create-thread": {
						const thread = value as ComposerThread;
						await this._lspClient.createThread(thread);
						await this._workspace.createThread(thread.id);
						if (!thread.fromMessage) {
							webviewView.webview.postMessage({
								command: "thread-data",
								value: {
									state: await this._lspClient.loadThread(thread.id),
									activeThreadId: thread.id,
								} satisfies ComposerThreadEvent,
							});
						}
						break;
					}
					case "branch-thread": {
						const thread = value as ComposerThread;
						await this._workspace.createThread(thread.id);
						await this._lspClient.createThread(thread);

						await this._lspClient.branchThread({
							threadId: thread.id,
							originalThreadId: thread.parentThreadId,
						});
						webviewView.webview.postMessage({
							command: "thread-data",
							value: {
								state: await this._lspClient.loadThread(thread.id),
								activeThreadId: thread.id,
							} satisfies ComposerThreadEvent,
						});
						break;
					}
					case "switch-thread": {
						const id = String(value);
						await this._workspace.switchThread(id);
						webviewView.webview.postMessage({
							command: "thread-data",
							value: {
								state: await this._lspClient.loadThread(id),
								activeThreadId: id,
							} satisfies ComposerThreadEvent,
						});
						break;
					}
					case "delete-thread": {
						await this._workspace.deleteThread(String(value));
						await this._lspClient.deleteThread(String(value));
						break;
					}
					case "rename-thread": {
						const event = value as RenameThreadEvent;
						await this._lspClient.updateThread({
							id: event.threadId,
							title: event.title,
						});
						webviewView.webview.postMessage({
							command: "thread-data",
							value: {
								state: await this._lspClient.loadThread(event.threadId),
								activeThreadId: (await this._workspace.load()).activeThreadId!,
							} satisfies ComposerThreadEvent,
						});
						break;
					}
					case "visualize-threads":
						this._threadViewProvider.visualizeThreads(
							this._workspace.getSettings(),
						);
						break;
					case "accept-file":
						await this.acceptFile(value as UpdateComposerFileEvent);
						break;
					case "reject-file":
						await this.rejectFile(value as UpdateComposerFileEvent);
						break;
					case "undo-file":
						await this.undoFile(value as UpdateComposerFileEvent);
						break;
					case "open-file":
						await vscode.commands.executeCommand(
							"vscode.open",
							vscode.Uri.file(
								path.join(
									this._workspace.workspacePath,
									(value as FileMetadata).path,
								),
							),
						);
						break;
					case "accept-command":
						await this.acceptOrRejectCommand(value as UpdateCommandEvent, true);
						break;
					case "reject-command":
						await this.acceptOrRejectCommand(
							value as UpdateCommandEvent,
							false,
							true,
						);
						break;

					case "openSettings":
						this._settingsViewProvider.openInPanel();
						break;
					case "diff-view": {
						const { file, threadId, toolId } = value as DiffViewCommand;
						this._diffViewProvider.createDiffView({
							file,
							onAccept: async (
								event: UpdateComposerFileEvent,
								isRevert: boolean,
							) => {
								await this.acceptFile(event, isRevert);
							},
							onReject: async (event: UpdateComposerFileEvent) => {
								await this.rejectFile(event);
							},
							threadId,
							toolId,
						});
						break;
					}
					case "clear-chat-history": {
						await this.clearChatHistory();
						const settings = await this._workspace.load();
						webviewView.webview.postMessage({
							command: "thread-data",
							value: {
								state: await this._lspClient.loadThread(
									settings.activeThreadId!,
								),
								activeThreadId: settings.activeThreadId!,
							} satisfies ComposerThreadEvent,
						});
						break;
					}
					case "clipboard": {
						vscode.env.clipboard.writeText(value as string);
						break;
					}
					case "get-files": {
						const searchTerm = value as string | undefined;
						if (!searchTerm || searchTerm?.length === 0) {
							webviewView.webview.postMessage({
								command: "get-files-result",
								value: [],
							});
							return;
						}

						try {
							// First level optimization: Use a more targeted search pattern
							// This significantly reduces the initial result set
							const filePattern = `**/*${searchTerm}*`;
							// Exclude common binary and build files to reduce initial result set
							const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
							const excludePattern = new vscode.RelativePattern(
								workspaceFolder!,
								"{**/node_modules/**,**/dist/**,**/build/**,**/*.jpg,**/*.jpeg,**/*.png,**/*.gif,**/*.ico,**/*.webp,**/*.mp3,**/*.mp4,**/*.woff,**/*.woff2}",
							);

							// const excludePattern =
							// 	"{**/node_modules/**,**/dist/**,**/build/**,**/*.{jpg,jpeg,png,gif,ico,webp,mp3,mp4,woff,woff2}}";

							const initialFiles = await vscode.workspace.findFiles(
								filePattern,
								excludePattern,
								500,
							);

							const matchingFiles: FileSearchResult[] = [];

							// Still apply gitignore check for precise control
							for (const file of initialFiles) {
								const shouldExclude = await isFileExcludedByGitignore(
									file.fsPath,
									this._workspace.workspacePath,
								);

								if (!shouldExclude) {
									const relativePath = vscode.workspace.asRelativePath(
										file.fsPath,
									);
									const fileName = path.basename(relativePath);

									matchingFiles.push({
										file: fileName,
										path: relativePath,
									});
								}
							}

							// Sort results to prioritize:
							// 1. Filename matches first (more relevant)
							// 2. Then by path length (shorter paths usually more relevant)
							matchingFiles.sort((a, b) => {
								// Check if filename contains search term
								const aFileMatch = a.file
									.toLowerCase()
									.includes(searchTerm.toLowerCase());
								const bFileMatch = b.file
									.toLowerCase()
									.includes(searchTerm.toLowerCase());

								// Filename matches take priority
								if (aFileMatch && !bFileMatch) return -1;
								if (bFileMatch && !aFileMatch) return 1;

								// If both or neither filenames match, shorter paths get priority
								return a.path.length - b.path.length;
							});

							// Optionally limit final results to improve UI performance
							const limitedResults = matchingFiles.slice(0, 50);

							webviewView.webview.postMessage({
								command: "get-files-result",
								value: limitedResults,
							});
						} catch (error) {
							console.error("Error searching files:", error);
							webviewView.webview.postMessage({
								command: "get-files-result",
								value: [],
							});
						}
						break;
					}

					case "compose": {
						const request = value as ComposerRequest;
						await this._lspClient.compose({
							...request,
							context: getChatContext(1024),
							recentFiles: getRecentFileTracker().getRecentFiles(),
						});
						break;
					}
					case "cancel": {
						await this._lspClient.cancelComposer(String(value));
						break;
					}
					case "ready": {
						const settings = await this._workspace.load();

						let threadPromises: Promise<ComposerState | null>[] = [];
						let resolvedThreads: ComposerState[] = [];
						if (settings.threadIds?.length) {
							// Use Promise.allSettled instead of Promise.all
							threadPromises = settings.threadIds.map((threadId) =>
								this._lspClient.loadThread(threadId).catch((error) => {
									console.error(`Failed to load thread ${threadId}:`, error);
									// Return null or a default/error state instead of throwing
									return null;
								}),
							);

							// Process the results, filtering out failed loads
							const settledResults = await Promise.all(threadPromises);
							resolvedThreads = settledResults.filter(
								(thread): thread is ComposerState => thread !== null,
							);

							// Optionally log how many threads failed to load
							const failedCount =
								settledResults.length - resolvedThreads.length;
							if (failedCount > 0) {
								console.warn(`${failedCount} thread(s) failed to load`);
								// You could also notify the user via the webview
							}
						}

						const appState: AppState = {
							workspaceFolder: getActiveWorkspace(),
							theme: vscode.window.activeColorTheme.kind,
							settings,
							totalFiles: 0,
							threads: resolvedThreads,
							activeThreadId: settings.activeThreadId,
						};

						webviewView.webview.postMessage({
							command: "init",
							value: appState,
						});

						webviewView.webview.postMessage({
							command: "settings",
							value: await wingmanSettings.loadSettings(),
						});
						this.showView(this._launchView);
						break;
					}
				}
			}),
			vscode.window.onDidChangeActiveColorTheme((theme: vscode.ColorTheme) => {
				webviewView.webview.postMessage({
					command: "setTheme",
					value: theme.kind,
				});
			}),
		);
	}

	private async saveImage(base64Data: string) {
		try {
			// Check if data URL prefix is present to extract mime type
			let mimeType = "image/png"; // Default mime type
			let base64Image = base64Data;

			const dataUrlMatch = base64Data.match(
				/^data:([a-zA-Z0-9]+\/[a-zA-Z0-9-.+]+);base64,(.*)$/,
			);
			if (dataUrlMatch) {
				mimeType = dataUrlMatch[1];
				base64Image = dataUrlMatch[2];
			} else {
				// If no data URL prefix, just remove it if it exists
				base64Image = base64Data.replace(/^data:image\/\w+;base64,/, "");
			}

			// Determine file extension from mime type
			const extensionMap: Record<string, string> = {
				"image/png": "png",
				"image/jpeg": "jpg",
				"image/jpg": "jpg",
				"image/webp": "webp",
				"image/gif": "gif",
				"image/svg+xml": "svg",
				"image/bmp": "bmp",
			};

			const extension = extensionMap[mimeType] || "png";

			// Create a buffer from the base64 string
			const imageBuffer = Buffer.from(base64Image, "base64");

			// Get current workspace folder as default location
			const workspaceFolders = vscode.workspace.workspaceFolders;
			const defaultUri =
				workspaceFolders && workspaceFolders.length > 0
					? vscode.Uri.joinPath(workspaceFolders[0].uri, `image.${extension}`)
					: vscode.Uri.file(`image.${extension}`);

			// Show native save dialog
			const result = await vscode.window.showSaveDialog({
				defaultUri,
				filters: {
					Images: ["png", "jpg", "jpeg", "webp", "gif", "svg", "bmp"],
				},
			});

			if (result) {
				// Write the file
				fs.writeFileSync(result.fsPath, imageBuffer);
				vscode.window.showInformationMessage(`Image saved to ${result.fsPath}`);
			}
		} catch (error) {
			vscode.window.showErrorMessage(
				`Failed to save image: ${error instanceof Error ? error.message : String(error)}`,
			);
		}
	}

	private async undoFile({ files, threadId, toolId }: UpdateComposerFileEvent) {
		try {
			const fileMap = new Map<string, FileMetadata>();
			for (const file of files) {
				const fileUri = vscode.Uri.joinPath(
					vscode.Uri.parse(this._workspace.workspacePath),
					file.path,
				);

				file.accepted = false;
				file.rejected = false;
				await vscode.workspace.fs.writeFile(
					fileUri,
					new TextEncoder().encode(file.original),
				);
				fileMap.set(file.id!, file);
			}
			await this._lspClient.updateComposerFile({
				files,
				threadId,
				toolId,
			});
			await this._webview?.postMessage({
				command: "thread-data",
				value: {
					state: await this._lspClient.loadThread(threadId),
					activeThreadId: threadId,
				} satisfies ComposerThreadEvent,
			});
		} catch (error) {
			console.error("Error undoing file changes:", error);
			// Consider showing an error notification to the user
		}
	}

	private async acceptFile(
		{ files, threadId, toolId }: UpdateComposerFileEvent,
		isRevert = false,
	): Promise<void> {
		const fileMap = new Map<string, FileMetadata>();
		for (const file of files) {
			const relativeFilePath = vscode.workspace.asRelativePath(file.path);
			const fileUri = vscode.Uri.joinPath(
				vscode.Uri.parse(this._workspace.workspacePath),
				relativeFilePath,
			);
			await vscode.workspace.fs.writeFile(
				fileUri,
				new TextEncoder().encode(file.code),
			);
			if (isRevert) {
				const code = file.code;
				file.code = file.original;
				file.original = code;
			}
			file.accepted = !isRevert;
			file.rejected = false;
			fileMap.set(file.id!, file);
		}
		const resumed = await this._lspClient.updateComposerFile({
			files,
			threadId,
			toolId,
		});
		if (!resumed) {
			await this._webview?.postMessage({
				command: "thread-data",
				value: {
					state: await this._lspClient.loadThread(threadId),
					activeThreadId: threadId,
				} satisfies ComposerThreadEvent,
			});
		}
	}

	private async rejectFile({
		files,
		threadId,
		toolId,
	}: UpdateComposerFileEvent) {
		try {
			const fileMap = new Map<string, FileMetadata>();
			for (const file of files) {
				file.accepted = false;
				file.rejected = true;
				fileMap.set(file.id!, file);
			}

			const resumed = await this._lspClient.updateComposerFile({
				files,
				threadId,
				toolId,
			});
			if (!resumed) {
				await this._webview?.postMessage({
					command: "thread-data",
					value: {
						state: await this._lspClient.loadThread(threadId),
						activeThreadId: threadId,
					} satisfies ComposerThreadEvent,
				});
			}
		} catch (error) {
			console.error("Error rejecting file:", error);
		}
	}

	private async acceptOrRejectCommand(
		{ command, threadId }: UpdateCommandEvent,
		accepted = false,
		rejected = false,
	): Promise<void> {
		command.accepted = accepted;
		command.rejected = rejected;

		const resumed = await this._lspClient.updateCommand({
			command,
			threadId,
		});
		if (!resumed) {
			await this._webview?.postMessage({
				command: "thread-data",
				value: {
					state: await this._lspClient.loadThread(threadId),
					activeThreadId: threadId,
				} satisfies ComposerThreadEvent,
			});
		}
	}

	private async clearChatHistory() {
		const settings = this._workspace.getSettings();

		if (settings.activeThreadId) {
			await this._lspClient.clearChatHistory(settings.activeThreadId);
		}
	}

	private getHtmlForWebview(webview: vscode.Webview) {
		const htmlUri = webview.asWebviewUri(
			vscode.Uri.joinPath(
				this._context.extensionUri,
				"out",
				"views",
				"chat.html",
			),
		);

		const nonce = getNonce();

		const htmlContent = fs.readFileSync(htmlUri.fsPath, "utf8");
		const imageUri = getImageUri(webview, this._context, [
			"media",
			vscode.window.activeColorTheme.kind === 1
				? "Logo-black.png"
				: "Logo-white.png",
		]);

		// Replace placeholders in the HTML content
		const finalHtmlContent = htmlContent
			.replace(/CSP_NONCE_PLACEHOLDER/g, nonce)
			.replace("LOGO_URL", imageUri.toString());

		const prefix = webview.asWebviewUri(
			vscode.Uri.joinPath(this._context.extensionUri, "out", "views"),
		);
		const srcHrefRegex = /(src|href)="([^"]+)"/g;

		// Replace the matched filename with the prefixed filename
		const updatedHtmlContent = finalHtmlContent.replace(
			srcHrefRegex,
			(match, attribute, filename) => {
				const prefixedFilename = `${prefix}${filename}`;
				return `${attribute}="${prefixedFilename}"`;
			},
		);

		return addNoneAttributeToLink(updatedHtmlContent, nonce);
	}
}

function getChatContext(contextWindow: number): CodeContextDetails | undefined {
	const editor = vscode.window.activeTextEditor;
	if (!editor) {
		return undefined;
	}

	const { document, selection } = editor;
	let codeContextRange: vscode.Range;
	let lastDirection = -1;

	if (selection && !selection.isEmpty) {
		codeContextRange = new vscode.Range(
			selection.start.line,
			selection.start.character,
			selection.end.line,
			selection.end.character,
		);
	} else {
		const currentLine = selection.active.line;
		let upperLine = currentLine;
		let lowerLine = currentLine;

		const halfContext = Math.floor(contextWindow / 2);

		let upperText = upperLine > 0 ? document.lineAt(upperLine - 1).text : "";
		let lowerText = document.lineAt(lowerLine).text;

		// Expand context in both directions
		for (let i = 0; i < halfContext; i++) {
			if (upperLine > 0) {
				upperLine--;
				upperText = `${document.lineAt(upperLine).text}\n${upperText}`;
				lastDirection = 0;
			}

			if (lowerLine < document.lineCount - 1) {
				lowerLine++;
				lowerText += `\n${document.lineAt(lowerLine).text}`;
				lastDirection = 1;
			}

			// Stop if we've reached the context window size
			if (upperText.length + lowerText.length >= contextWindow) {
				break;
			}
		}

		const beginningWindowLine = document.lineAt(upperLine);
		const endWindowLine = document.lineAt(lowerLine);

		codeContextRange = new vscode.Range(
			beginningWindowLine.range.start,
			endWindowLine.range.end,
		);
	}

	let text = document.getText(codeContextRange);

	if (text.length > contextWindow) {
		if (lastDirection === 0) {
			text = text.substring(text.length - contextWindow, text.length);
		} else if (lastDirection === 1) {
			text = text.substring(0, contextWindow);
		}
	}

	const documentUri = vscode.Uri.file(document.fileName);
	const workspaceFolder = vscode.workspace.getWorkspaceFolder(documentUri);

	return {
		text,
		currentLine: document.lineAt(selection.active.line).text,
		lineRange: `${codeContextRange.start.line}-${codeContextRange.end.line}`,
		fileName: document.fileName,
		workspaceName: workspaceFolder?.name ?? "",
		language: document.languageId,
		fromSelection: !selection.isEmpty,
	};
}

function getImageUri(
	webview: vscode.Webview,
	context: vscode.ExtensionContext,
	imagePath: string[],
) {
	return webview.asWebviewUri(
		vscode.Uri.joinPath(context.extensionUri, ...imagePath),
	);
}
