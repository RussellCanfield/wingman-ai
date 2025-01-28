import * as vscode from "vscode";
import fs from "node:fs";
import { eventEmitter } from "../events/eventEmitter";
import { AIProvider } from "../service/base";
import {
	AppMessage,
	CodeContext,
	CodeContextDetails,
	CodeReviewMessage,
	CommitMessage,
	FileMetadata,
} from "@shared/types/Message";
import { AppState, Settings } from "@shared/types/Settings";
import { IndexerSettings } from "@shared/types/Indexer";
import { loggingProvider } from "./loggingProvider";
import {
	addNoneAttributeToLink,
	extractCodeBlock,
	getActiveWorkspace,
	getNonce,
	getSymbolsFromOpenFiles,
} from "./utilities";
import { LSPClient } from "../client/index";
import {
	ComposerRequest,
	DiffViewCommand,
	FileSearchResult,
} from "@shared/types/v2/Composer";
import { DiffViewProvider } from "./diffViewProvider";
import { CustomTimeoutExitCode, WingmanTerminal } from "./terminalProvider";
import {
	EVENT_CHAT_SENT,
	EVENT_COMMIT_MSG,
	EVENT_REVIEW_FILE_BY_FILE,
	EVENT_VALIDATE_FAILED,
	EVENT_VALIDATE_SUCCEEDED,
	telemetry,
} from "./telemetryProvider";
import { Workspace } from "../service/workspace";
import { getGitignorePatterns } from "../server/files/utils";
import { CodeReviewer } from "../commands/review/codeReviewer";
import { ConfigViewProvider } from "./configViewProvider";
import path from "node:path";

let abortController = new AbortController();
let wingmanTerminal: WingmanTerminal | undefined;

export type ChatView = "chat" | "composer" | "indexer";

export class ChatViewProvider implements vscode.WebviewViewProvider {
	public static readonly viewType = "wingman.chatview";
	public static readonly showComposerCommand = "wingmanai.opencomposer";

	private _disposables: vscode.Disposable[] = [];
	private _webview: vscode.Webview | undefined;
	private _launchView: ChatView = "chat";

	constructor(
		private readonly _lspClient: LSPClient,
		private readonly _aiProvider: AIProvider,
		private readonly _context: vscode.ExtensionContext,
		private readonly _diffViewProvider: DiffViewProvider,
		private readonly _workspace: Workspace,
		private readonly _settings: Settings,
		private readonly _settingsViewProvider: ConfigViewProvider
	) { }

	dispose() {
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

	public resolveWebviewView(
		webviewView: vscode.WebviewView,
		context: vscode.WebviewViewResolveContext,
		token: vscode.CancellationToken
	) {
		this._webview = webviewView.webview;
		webviewView.webview.options = {
			enableScripts: true,
			localResourceRoots: [vscode.Uri.joinPath(this._context.extensionUri, 'media'), vscode.Uri.joinPath(this._context.extensionUri, 'out')]
		};

		webviewView.webview.html = this.getHtmlForWebview(webviewView.webview);

		this._lspClient.setComposerWebViewReference(webviewView.webview);

		token.onCancellationRequested((e) => {
			abortController.abort();
			eventEmitter._onQueryComplete.fire();
		});

		wingmanTerminal = new WingmanTerminal(
			vscode.workspace.workspaceFolders?.[0].uri.fsPath || ""
		);
		wingmanTerminal.subscribe(async (data, code) => {
			if (!data) return;

			if (code === CustomTimeoutExitCode) {
				loggingProvider.logInfo("Validation command timeout occurred");
				this._webview?.postMessage({
					command: "validation-success",
				});
				wingmanTerminal?.cancel();
				return;
			}

			loggingProvider.logInfo(`Validation command output:\n\n${data}`);
			const output = await this._aiProvider.getRerankModel()
				.invoke(`You are a senior software engineer.
Analyze the following command output.

Rules:
- Determine if the command ran successfully or not.
- If the command did not run successfully try to succinctly identify what the error may be.
- Provide a concise summary of the error, if present.
- The summary should include details required to take action and fix the error(s). This might include files or paths.
- If there was no exit code, and an error is not obvious, assume it was successful.
- Return your response in JSON format, do not include markdown or any other text.

Example JSON output format:
{
   "success": true|false,
   "summary": "Command files due to xyz"
}
   
-----

Command executed:
${this._settings.validationSettings.validationCommand}

Exit code: 
${code || "Not available."}

Command output:
${data}
`);

			const result = JSON.parse(output.content.toString()) as {
				success: boolean;
				summary: string;
			};

			if (result.success) {
				telemetry.sendEvent(EVENT_VALIDATE_SUCCEEDED, {
					command:
						this._settings.validationSettings.validationCommand ||
						"",
				});
				this._webview?.postMessage({
					command: "validation-success",
				});
				wingmanTerminal?.cancel();
				return;
			}

			telemetry.sendEvent(EVENT_VALIDATE_FAILED, {
				command:
					this._settings.validationSettings.validationCommand || "",
			});

			this._webview?.postMessage({
				command: "validation-failed",
				value: `Fixing build errors...

Here is a summary of the command output:
${result.summary}`,
			});
		});

		const codeReviewer = new CodeReviewer(
			this._workspace.workspacePath,
			this._aiProvider
		);

		this._disposables.push(
			webviewView.webview.onDidReceiveMessage(
				async (data: AppMessage) => {
					if (!data) {
						return;
					}

					const { command, value } = data;

					// TODO - save me from the insanity of this switch statement :D
					switch (command) {
						case "undo-file":
							webviewView.webview.postMessage({
								command: "compose-response",
								value: {
									node: "composer-replace",
									values: {
										...(await this._lspClient.undoComposerFile(value as FileMetadata))
									}
								}
							});
							break;
						case "open-file":
							await vscode.commands.executeCommand('vscode.open', vscode.Uri.file(path.join(this._workspace.workspacePath, (value as FileMetadata).path)));
							break;
						case "reject-file":
							webviewView.webview.postMessage({
								command: "compose-response",
								value: {
									node: "composer-replace",
									values: {
										...(await this._lspClient.rejectComposerFile(value as FileMetadata))
									}
								}
							});
							break;
						case "openSettings":
							this._settingsViewProvider.openInPanel();
							break;
						case "delete-indexed-file":
							await this._lspClient.deleteFileFromIndex(String(value));
							break;
						case "review-files":
							telemetry.sendEvent(EVENT_REVIEW_FILE_BY_FILE);
							this._diffViewProvider.createCodeReviewView(
								(value as CodeReviewMessage).review
							);
							break;
						case "web_search":
							this.handleWebSearch(value as string, webviewView.webview);
							break;
						case "review":
							const review =
								await codeReviewer.generateDiffsAndSummary(
									String(value)
								);

							telemetry.sendEvent(EVENT_COMMIT_MSG);

							if (!review) {
								webviewView.webview.postMessage({
									command: "code-review-failed",
								});
								return;
							}

							webviewView.webview.postMessage({
								command: "code-review-result",
								value: {
									review,
									type: "code-review",
								} satisfies CodeReviewMessage,
							});
							break;
						case "commit_msg":
							const commitReview =
								await codeReviewer.generateCommitMessage(
									String(value)
								);

							telemetry.sendEvent(EVENT_COMMIT_MSG);

							if (!commitReview) {
								webviewView.webview.postMessage({
									command: "commit-msg-failed",
								});
								return;
							}

							webviewView.webview.postMessage({
								command: "commit-msg-result",
								value: {
									message: `Please use the following commit message for your staged changes:

\`\`\`plaintext								
${commitReview}
\`\`\``,
									type: "commit-msg",
									loading: false
								} satisfies CommitMessage,
							});
							break;
						case "state-update":
							const appState = value as AppState;
							const currentSettings = await this._workspace.load();

							if (currentSettings.indexerSettings.indexFilter !== appState.settings.indexerSettings.indexFilter) {
								const matchingFiles =
									await vscode.workspace.findFiles(
										appState.settings.indexerSettings.indexFilter ?? "*",
										(await getGitignorePatterns(
											this._workspace.workspacePath
										)) || ""
									);

								appState.totalFiles = matchingFiles?.length ?? 0;
								webviewView.webview.postMessage({
									command: "file-count-update",
									value: appState,
								});
							}

							await this._workspace.save({
								indexerSettings:
									appState.settings.indexerSettings,
								chatMessages: appState.settings.chatMessages,
							});
							this._lspClient.setIndexerSettings(
								appState.settings.indexerSettings
							);
							break;
						case "diff-view":
							const { file } = value as DiffViewCommand;

							this._diffViewProvider.createDiffView({
								file,
								onAccept: async (f: FileMetadata) => {
									webviewView.webview.postMessage({
										command: "compose-response",
										value: {
											node: "composer-replace",
											values: {
												...(await this._lspClient.acceptComposerFile(f))
											}
										}
									});

								},
								onReject: async (f: FileMetadata) => {
									webviewView.webview.postMessage({
										command: "compose-response",
										value: {
											node: "composer-replace",
											values: {
												...(await this._lspClient.rejectComposerFile(f))
											}
										}
									});
								}
							});
							break;
						case "validate":
							if (
								this._settings.validationSettings
									?.validationCommand
							) {
								loggingProvider.logInfo(
									`Validating using command: ${this._settings.validationSettings.validationCommand}`
								);
								wingmanTerminal?.spawn();
								wingmanTerminal?.sendCommand(
									this._settings.validationSettings
										.validationCommand
								);
							}
							break;
						case "cancel-validate":
							wingmanTerminal?.cancel();
							break;
						case "clear-chat-history":
							await this._workspace.save({
								chatMessages: [],
							});
							this._aiProvider.clearChatHistory();
							await this._lspClient.clearChatHistory();
							break;
						case "terminal":
							// Use value to spawn new terminal with command
							const terminalCommand = value as string;
							const terminal = vscode.window.createTerminal({
								name: "Wingman Command",
							});
							terminal.show();
							terminal.sendText(terminalCommand);
							break;
						case "accept-file":
							const acceptedFile = value as FileMetadata;
							const { path: artifactFile, code: markdown } = acceptedFile;

							let code = markdown?.startsWith("```")
								? extractCodeBlock(markdown)
								: markdown;
							const relativeFilePath = vscode.workspace.asRelativePath(artifactFile);

							const fileUri = vscode.Uri.joinPath(
								vscode.Uri.parse(this._workspace.workspacePath),
								relativeFilePath
							);

							try {
								// Convert the code string to Uint8Array for writing
								const contentBytes = new TextEncoder().encode(code);

								// Write the file contents directly
								await vscode.workspace.fs.writeFile(fileUri, contentBytes);

								webviewView.webview.postMessage({
									command: "compose-response",
									value: {
										node: "composer-replace",
										values: {
											...(await this._lspClient.acceptComposerFile(acceptedFile))
										}
									}
								});
							} catch (error) {
								console.error('Failed to write file:', error);
								throw error;
							}
							break;
						case "get-files":
							const searchTerm = value as string | undefined;
							if (!searchTerm || searchTerm?.length === 0) {
								return [];
							}

							const settings = await this._workspace.load();

							// Find all files in the workspace that match the search term
							const matchingFiles =
								await vscode.workspace.findFiles(
									settings.indexerSettings.indexFilter,
									(await getGitignorePatterns(
										this._workspace.workspacePath
									)) || ""
								);

							// Convert to relative paths
							const filteredFiles: FileSearchResult[] =
								matchingFiles.filter(f => f.fsPath.includes(searchTerm)).map((file) => {
									const path =
										vscode.workspace.asRelativePath(
											file.fsPath
										);
									return {
										file: path.split("/").pop()!,
										path,
									} satisfies FileSearchResult;
								});

							webviewView.webview.postMessage({
								command: "get-files-result",
								value: filteredFiles,
							});
							break;
						case "compose":
							await this._lspClient.compose(
								value as ComposerRequest
							);
							break;
						case "delete-index":
							await this._lspClient.deleteIndex();
							webviewView.webview.postMessage({
								command: "index-status",
								value: {
									...(await this._lspClient.indexExists())
								}
							});
							break;
						case "build-index":
							const { indexFilter, exclusionFilter } =
								value as IndexerSettings;
							await this._workspace.save({
								indexerSettings: {
									indexFilter,
									exclusionFilter,
								},
							});
							await this._lspClient.buildFullIndex({
								indexFilter,
								exclusionFilter,
							});
							break;
						case "check-index":
							webviewView.webview.postMessage({
								command: "index-status",
								value: {
									...(await this._lspClient.indexExists())
								}
							});
							break;
						case "chat": {
							this.handleChatMessage({ value, webview: webviewView.webview });
							break;
						}
						case "cancel": {
							abortController.abort();
							await this._lspClient.cancelComposer();
							break;
						}
						case "clipboard": {
							vscode.env.clipboard.writeText(value as string);
							break;
						}
						case "copyToFile": {
							this.sendContentToNewDocument(value as string);
							break;
						}
						case "showContext": {
							const { fileName, lineRange } =
								value as CodeContext;
							const [start, end] = lineRange
								.split("-")
								.map(Number);
							const uri = vscode.Uri.file(fileName);
							vscode.window.showTextDocument(uri).then(() => {
								if (!vscode.window.activeTextEditor) {
									return;
								}

								vscode.window.activeTextEditor.selection =
									new vscode.Selection(
										new vscode.Position(start, 0),
										new vscode.Position(end, 0)
									);
							});
							break;
						}
						case "ready": {
							const settings = await this._workspace.load();

							const appState: AppState = {
								workspaceFolder: getActiveWorkspace(),
								theme: vscode.window.activeColorTheme.kind,
								settings,
								totalFiles: 0
							};

							webviewView.webview.postMessage({
								command: "init",
								value: appState,
							});

							setTimeout(async () => {
								webviewView.webview.postMessage({
									command: "index-status",
									value: {
										...(await this._lspClient.indexExists())
									}
								});

								webviewView.webview.postMessage({
									command: "available-files",
									value: (await vscode.workspace.findFiles(
										settings.indexerSettings.indexFilter ?? "*",
										(await getGitignorePatterns(
											this._workspace.workspacePath
										)) || ""
									)).length
								})
							}, 0);
							this.showView(this._launchView);
							break;
						}
					}
				}
			),
			vscode.window.onDidChangeActiveColorTheme(
				(theme: vscode.ColorTheme) => {
					webviewView.webview.postMessage({
						command: "setTheme",
						value: theme.kind,
					});
				}
			)
		);
	}

	private async sendContentToNewDocument(content: string) {
		const newFile = await vscode.workspace.openTextDocument({
			content,
		});
		vscode.window.showTextDocument(newFile);
	}

	private async handleChatMessage({
		value,
		webview,
	}: Pick<AppMessage, "value"> & { webview: vscode.Webview }) {
		abortController = new AbortController();

		await this.streamChatResponse(
			value as string,
			getChatContext(
				this._settings.interactionSettings.chatContextWindow
			),
			webview
		);
	}

	private async streamChatResponse(
		prompt: string,
		context: CodeContextDetails | undefined,
		webview: vscode.Webview
	) {
		let ragContext = "";

		const { codeDocs, projectDetails } =
			await this._lspClient.getEmbeddings(prompt);

		const symbols = await getSymbolsFromOpenFiles();

		try {
			telemetry.sendEvent(EVENT_CHAT_SENT, {
				embeddingCount: (codeDocs?.length ?? 0).toString(),
				aiProvider: this._settings.aiProvider,
				model: this._settings.providerSettings[
					this._settings.aiProvider
				]?.chatModel,
			});
		} catch { }

		ragContext = `{LANGUAGE_TEMPLATE}
{FILE_TEMPLATE}

{PROJECT_TEMPLATE}

{CONTEXT_TEMPLATE}

{SYMBOLS_TEMPLATE}

{CURRENT_LINE_TEMPLATE}`;

		ragContext = ragContext.replace(
			"{LANGUAGE_TEMPLATE}",
			!context?.language ? "" : `Current language:\n${context?.language}.`
		);

		ragContext = ragContext.replace(
			"{FILE_TEMPLATE}",
			!context?.fileName ? "" : `Current file:\n${context?.fileName}`
		);

		ragContext =
			ragContext.replace(
				"{CONTEXT_TEMPLATE}",
				!context?.text
					? ""
					: context.fromSelection
						? `The user has selected the following code and wishes you to focus on it:\n${context.text}`
						: `The user has provided a snippet of code from the file they are working on:\n${context.text}`
			) + "\n\n=======";

		ragContext = ragContext.replace(
			"{CURRENT_LINE_TEMPLATE}",
			!context?.currentLine || context?.fromSelection
				? ""
				: `The user is currently working on the following line:\n${context?.currentLine}`
		);

		if (projectDetails) {
			ragContext = ragContext.replace(
				"{PROJECT_TEMPLATE}",
				!projectDetails
					? ""
					: `Here are details about the current project:
${projectDetails}

=======`
			);
		}

		if (codeDocs?.length === 0) {
			ragContext = ragContext.replace(
				"{SYMBOLS_TEMPLATE}",
				`Here are the available types reference by the code in context to use as a reference when answering questions, these may not be related to the code provided:

${symbols}

=======`
			);
		} else {
			ragContext = ragContext.replace(
				"{SYMBOLS_TEMPLATE}",
				`Use these code snippets from the current project as a reference when answering questions.
These code snippets serve as additional context for the user's question:

${codeDocs.join("\n\n----\n")}

=======`
			);
		}

		if (context) {
			const { fileName, lineRange, workspaceName } = context;
			webview.postMessage({
				command: "context",
				value: {
					fileName,
					lineRange,
					workspaceName,
				} satisfies CodeContext,
			});
		}

		eventEmitter._onQueryStart.fire();

		const response = this._aiProvider.chat(
			prompt,
			ragContext,
			abortController.signal
		);

		for await (const chunk of response) {
			webview.postMessage({
				command: "response",
				value: chunk,
			});
		}

		eventEmitter._onQueryComplete.fire();

		webview.postMessage({
			command: "done",
			value: null,
		});
	}

	private async handleWebSearch(input: string, webview: vscode.Webview) {
		try {
			const stream = this._lspClient.streamWebSearch(input);

			let msg = '';
			for await (const chunk of stream) {
				msg += chunk;
			}

			await this.handleChatMessage({
				value: `Take the following researched information and help answer my question.
Question ${input}

Researched Information:
${msg}`, webview
			});
		} catch (error) {
			webview.postMessage({
				command: "done",
				content: error instanceof Error ? error.message : "Search failed"
			});
		}
	}

	private getHtmlForWebview(webview: vscode.Webview) {
		const htmlUri = webview.asWebviewUri(
			vscode.Uri.joinPath(
				this._context.extensionUri,
				"out",
				"views",
				"chat.html"
			)
		);

		const nonce = getNonce();

		const htmlContent = fs.readFileSync(htmlUri.fsPath, "utf8");
		const imageUri = getImageUri(webview, this._context, ['media',
			vscode.window.activeColorTheme.kind === 1 ? 'Logo-black.png' : 'Logo-white.png']);

		// Replace placeholders in the HTML content
		const finalHtmlContent = htmlContent.replace(
			/CSP_NONCE_PLACEHOLDER/g,
			nonce
		).replace('LOGO_URL', imageUri.toString());

		const prefix = webview.asWebviewUri(
			vscode.Uri.joinPath(this._context.extensionUri, "out", "views")
		);
		const srcHrefRegex = /(src|href)="([^"]+)"/g;

		// Replace the matched filename with the prefixed filename
		const updatedHtmlContent = finalHtmlContent.replace(
			srcHrefRegex,
			(match, attribute, filename) => {
				const prefixedFilename = `${prefix}${filename}`;
				return `${attribute}="${prefixedFilename}"`;
			}
		);

		return addNoneAttributeToLink(updatedHtmlContent, nonce);
	}

	private log = (value: unknown) => {
		loggingProvider.logInfo(JSON.stringify(value ?? ""));
	};
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
			selection.end.character
		);
	} else {
		const currentLine = selection.active.line;
		let upperLine = currentLine;
		let lowerLine = currentLine;

		const halfContext = Math.floor(contextWindow / 2);

		let upperText =
			upperLine > 0 ? document.lineAt(upperLine - 1).text : "";
		let lowerText = document.lineAt(lowerLine).text;

		// Expand context in both directions
		for (let i = 0; i < halfContext; i++) {
			if (upperLine > 0) {
				upperLine--;
				upperText = document.lineAt(upperLine).text + "\n" + upperText;
				lastDirection = 0;
			}

			if (lowerLine < document.lineCount - 1) {
				lowerLine++;
				lowerText += "\n" + document.lineAt(lowerLine).text;
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
			endWindowLine.range.end
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

function getImageUri(webview: vscode.Webview, context: vscode.ExtensionContext, imagePath: string[]) {
	return webview.asWebviewUri(vscode.Uri.joinPath(context.extensionUri, ...imagePath));
}