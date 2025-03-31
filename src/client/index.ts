import * as vscode from "vscode";
import type { ExtensionContext } from "vscode";
import {
	type DocumentSymbol,
	LanguageClient,
	type LanguageClientOptions,
	type Location,
	type LocationLink,
	type ServerOptions,
	TransportKind,
} from "vscode-languageclient/node";
import type { TypeRequestEvent } from "../server/retriever";
import type { IndexFile, Settings } from "@shared/types/Settings";
import type {
	ComposerRequest,
	ComposerResponse,
	FileDiagnostic,
	ComposerState,
	ComposerThread,
} from "@shared/types/Composer";
import path from "node:path";
import { mapLocation, mapSymbol } from "./utils";
import { loggingProvider } from "../providers/loggingProvider";
import {
	EVENT_AI_PROVIDER_VALIDATION_FAILED,
	EVENT_COMPOSE_PHASE,
	EVENT_COMPOSE_STARTED,
	telemetry,
} from "../providers/telemetryProvider";
import type {
	FixDiagnosticsEvent,
	UpdateCommandEvent,
	UpdateComposerFileEvent,
} from "@shared/types/Events";
import { WingmanFileWatcher } from "../providers/fileWatcher";
import { wingmanSettings } from "../service/settings";
import { generateWorkspaceGlobPatterns } from "../providers/globProvider";
import {
	CreateAIProvider,
	CreateEmbeddingProvider,
} from "../service/utils/models";
import type { MessageContentText } from "@langchain/core/messages";
import * as sound from "sound-play";

let client: LanguageClient;

export class LSPClient {
	composerWebView: vscode.Webview | undefined;
	settings: Settings | undefined;
	fileWatcher: WingmanFileWatcher | undefined;

	activate = async (
		context: ExtensionContext,
		settings: Settings | undefined,
	) => {
		this.settings = settings;
		const serverModule = vscode.Uri.joinPath(
			context.extensionUri,
			"out",
			"server.js",
		).fsPath;

		const debugOptions = { execArgv: ["--nolazy", "--inspect=6009"] };

		// If the extension is launched in debug mode then the debug server options are used
		// Otherwise the run options are used
		const serverOptions: ServerOptions = {
			run: { module: serverModule, transport: TransportKind.ipc },
			debug: {
				module: serverModule,
				transport: TransportKind.ipc,
				options: debugOptions,
			},
		};

		const clientOptions: LanguageClientOptions = {
			documentSelector: [{ scheme: "file", language: "*" }],
			outputChannel: vscode.window.createOutputChannel(
				"Wingman Language Server",
			),
			connectionOptions: {
				maxRestartCount: 3,
			},
			initializationOptions: {
				extensionPath: context.extensionPath,
				storagePath: context.globalStorageUri.fsPath,
			},
		};

		client = new LanguageClient(
			"WingmanLSP",
			"Wingman Language Server",
			serverOptions,
			clientOptions,
		);

		// Start the client. This will also launch the server
		await client.start();

		if (settings?.embeddingSettings.General.enabled) {
			if (!settings.embeddingSettings.General.globPattern) {
				generateWorkspaceGlobPatterns(
					CreateAIProvider(settings, loggingProvider),
					vscode.workspace.workspaceFolders![0].uri.fsPath,
				)
					.then(async (msg) => {
						const settings = await wingmanSettings.loadSettings();
						const textContent =
							typeof msg === "string"
								? msg
								: Array.isArray(msg.content)
									? (
											msg.content.find(
												(m) => m.type === "text",
											)! as MessageContentText
										).text
									: msg.content;

						await wingmanSettings.saveSettings({
							...settings,
							embeddingSettings: {
								...settings.embeddingSettings,
								General: {
									enabled: settings.embeddingSettings.General.enabled,
									globPattern: textContent,
								},
							},
						});

						if (
							settings!.embeddingSettings[settings!.embeddingProvider]
								?.dimensions!
						) {
							this.fileWatcher = new WingmanFileWatcher(this);
							await this.fileWatcher.initialize(
								this.settings?.embeddingSettings.General.globPattern!,
							);
						}
					})
					.catch((e) => {
						loggingProvider.logError(`Unable to generate glob patterns: ${e}`);
					});
			} else {
				if (
					settings!.embeddingSettings[settings!.embeddingProvider]?.dimensions!
				) {
					this.fileWatcher = new WingmanFileWatcher(this);
					await this.fileWatcher.initialize(
						this.settings?.embeddingSettings.General.globPattern!,
					);
				}
			}
		}

		client.onRequest("wingman/compose", async (params: ComposerResponse) => {
			loggingProvider.logInfo(JSON.stringify(params));
			telemetry.sendEvent(EVENT_COMPOSE_PHASE, {
				phase: params.event,
			});

			const settings = await wingmanSettings.loadSettings();
			if (
				settings.agentSettings.playAudioAlert &&
				(params.event === "composer-done" ||
					params.event === "composer-error" ||
					params.state.canResume)
			) {
				try {
					const filePath = `${context.extensionPath}/audio/ui-notification.mp3`;
					sound.play(filePath);
				} catch (e) {
					console.error("Failed to play sound", e);
				}
			}

			await this.composerWebView?.postMessage({
				command: "compose-response",
				value: params,
			});
		});

		client.onRequest("wingman/provideDocumentSymbols", async (params) => {
			if (!params.uri) {
				return [];
			}

			const document = await vscode.workspace.openTextDocument(
				vscode.Uri.parse(params.uri),
			);
			const symbols = await vscode.commands.executeCommand<DocumentSymbol[]>(
				"vscode.executeDocumentSymbolProvider",
				document.uri,
			);
			return symbols?.map((s) => mapSymbol(s)) || [];
		});

		client.onRequest(
			"wingman/provideDefinition",
			async (params: TypeRequestEvent) => {
				const document = await vscode.workspace.openTextDocument(
					vscode.Uri.parse(params.uri),
				);
				const locations = await vscode.commands.executeCommand<
					(Location | LocationLink)[]
				>("vscode.executeDefinitionProvider", document.uri, params.position);
				return locations?.map((l) => mapLocation(l)) || [];
			},
		);

		client.onRequest(
			"wingman/provideTypeDefiniton",
			async (params: TypeRequestEvent) => {
				const document = await vscode.workspace.openTextDocument(
					vscode.Uri.parse(params.uri),
				);
				const locations = await vscode.commands.executeCommand<
					(Location | LocationLink)[]
				>(
					"vscode.executeTypeDefinitionProvider",
					document.uri,
					params.position,
				);
				return locations?.map((l) => mapLocation(l)) || [];
			},
		);

		client.onRequest(
			"wingman/provideFileDiagnostics",
			async (filePaths: string[]) => {
				const fileUrls = filePaths.map((p) => {
					return path.isAbsolute(p)
						? vscode.Uri.parse(p)
						: vscode.Uri.joinPath(vscode.workspace.workspaceFolders![0].uri, p);
				});

				const fileDiagnostics: FileDiagnostic[] = [];
				for (const uri of fileUrls) {
					// Get all diagnostics for this file
					const allDiagnostics = vscode.languages.getDiagnostics(uri);

					// Filter for the specific types you're interested in
					const importIssues = allDiagnostics.filter(
						(diag) =>
							diag.message.includes("import") ||
							diag.message.includes("Cannot find module"),
					);

					const lintingErrors = allDiagnostics.filter(
						(diag) =>
							// Filter for your specific linting errors of interest
							diag.source === "eslint" ||
							diag.source === "tslint" ||
							diag.source === "biome" ||
							diag.source === "ts",
					);

					if (lintingErrors.length === 0 && importIssues.length === 0) continue;

					fileDiagnostics.push({
						path: vscode.workspace.asRelativePath(uri),
						importErrors: importIssues.map((f) => ({
							message: f.message,
							start: {
								line: f.range.start.line,
								character: f.range.start.character,
							},
							end: {
								line: f.range.end.line,
								character: f.range.end.character,
							},
						})),
						lintErrors: lintingErrors.map((f) => ({
							message: f.message,
							start: {
								line: f.range.start.line,
								character: f.range.start.character,
							},
							end: {
								line: f.range.end.line,
								character: f.range.end.character,
							},
						})),
					});
				}

				if (this.composerWebView) {
					this.composerWebView.postMessage({
						command: "diagnostics",
						value: fileDiagnostics,
					});
				}

				return fileDiagnostics;
			},
		);
	};

	indexFiles = async (indexFiles: Map<string, IndexFile>) => {
		const settings = await wingmanSettings.loadSettings();

		if (settings.embeddingSettings.General.enabled) {
			if (!this.fileWatcher) {
				this.fileWatcher = new WingmanFileWatcher(this);
				await this.fileWatcher.initialize(
					settings.embeddingSettings.General.globPattern,
				);
			}
		} else {
			if (this.fileWatcher) {
				this.fileWatcher.dispose();
				this.fileWatcher = undefined;
			}
		}
		client.sendRequest("wingman/indexFiles", Array.from(indexFiles.entries()));
	};

	removeFileFromIndex = async (filePath: string) => {
		console.log(filePath);
	};

	setComposerWebViewReference = (webview: vscode.Webview) => {
		this.composerWebView = webview;
	};

	compose = async (request: ComposerRequest) => {
		try {
			telemetry.sendEvent(EVENT_COMPOSE_STARTED, {
				numberOfFiles: request.contextFiles.length.toString(),
				aiProvider: this.settings?.aiProvider || "Unknown",
				model:
					this.settings?.providerSettings[this.settings.aiProvider]
						?.codeModel || "Unknown",
			});
		} catch {}
		return client.sendRequest<ComposerResponse>("wingman/compose", {
			request,
		});
	};

	isRunning = () => client?.isRunning() ?? false;

	validate = async (workspace: string) => {
		const settings = await wingmanSettings.loadSettings();

		try {
			let aiProvider = CreateAIProvider(settings, loggingProvider);

			if (!(await aiProvider.validateSettings())) {
				telemetry.sendEvent(EVENT_AI_PROVIDER_VALIDATION_FAILED, {
					aiProvider: settings.aiProvider,
				});
				throw new Error(
					`AI Provider: ${settings.aiProvider} is not configured correctly. If you're using Ollama, try changing the model and saving your settings.`,
				);
			}

			if (settings.embeddingSettings.General.enabled) {
				aiProvider = CreateEmbeddingProvider(settings, loggingProvider);

				if (!(await aiProvider.validateSettings())) {
					telemetry.sendEvent(EVENT_AI_PROVIDER_VALIDATION_FAILED, {
						aiProvider: settings.aiProvider,
					});
					throw new Error(
						`Embeddings Provider: ${settings.aiProvider} is not configured correctly. If you're using Ollama, try changing the model and saving your settings.`,
					);
				}
			}
			return true;
		} catch (e) {
			console.error(e);
			throw e;
		}
	};

	fixDiagnostics = async (event: FixDiagnosticsEvent) => {
		return client.sendRequest<ComposerResponse>(
			"wingman/fixDiagnostics",
			event,
		);
	};

	clearChatHistory = async (activeThreadId: string) => {
		return client.sendRequest("wingman/clearChatHistory", activeThreadId);
	};

	updateComposerFile = async (
		event: UpdateComposerFileEvent,
	): Promise<ComposerState> => {
		return client.sendRequest("wingman/updateComposerFile", event);
	};

	updateCommand = async ({
		command,
		threadId,
	}: UpdateCommandEvent): Promise<ComposerState> => {
		return client.sendRequest("wingman/updateCommand", {
			command,
			threadId,
		});
	};

	branchThread = async ({
		threadId,
		originalThreadId,
	}: { threadId: string; originalThreadId: string | undefined }) => {
		return client.sendRequest("wingman/branchThread", {
			threadId,
			originalThreadId,
		});
	};

	loadThread = async (threadId: string): Promise<ComposerState> => {
		return client.sendRequest("wingman/getThreadById", threadId);
	};

	createThread = async (thread: ComposerThread) => {
		return client.sendRequest("wingman/createThread", thread);
	};

	deleteThread = async (threadId: string) => {
		return client.sendRequest("wingman/deleteThread", threadId);
	};

	updateThread = async (thread: Partial<ComposerThread>) => {
		return client.sendRequest("wingman/updateThread", thread);
	};

	deleteIndex = async () => {
		return client.sendRequest("wingman/deleteIndex");
	};

	cancelComposer = async () => {
		return client.sendRequest("wingman/cancelComposer");
	};

	getIndexedFiles = async (): Promise<string[]> => {
		return client.sendRequest("wingman/getIndexedFiles");
	};

	resyncIndex = async () => {
		return client.sendRequest("wingman/resyncIndex");
	};

	updateSettings = async () => {
		const settings = await wingmanSettings.loadSettings();
		try {
			if (
				settings.embeddingSettings.General.enabled &&
				!settings.embeddingSettings.General.globPattern
			) {
				generateWorkspaceGlobPatterns(
					CreateAIProvider(settings, loggingProvider),
					vscode.workspace.workspaceFolders![0].uri.fsPath,
				)
					.then(async (msg) => {
						const settings = await wingmanSettings.loadSettings();
						const textContent =
							typeof msg === "string"
								? msg
								: Array.isArray(msg.content)
									? (
											msg.content.find(
												(m) => m.type === "text",
											)! as MessageContentText
										).text
									: msg.content;

						await wingmanSettings.saveSettings({
							...settings,
							embeddingSettings: {
								...settings.embeddingSettings,
								General: {
									enabled: settings.embeddingSettings.General.enabled,
									globPattern: textContent,
								},
							},
						});

						if (
							settings!.embeddingSettings[settings!.embeddingProvider]
								?.dimensions!
						) {
							this.fileWatcher = new WingmanFileWatcher(this);
							await this.fileWatcher.initialize(
								this.settings?.embeddingSettings.General.globPattern!,
							);
						}
					})
					.catch((e) => {
						loggingProvider.logError(`Unable to generate glob patterns: ${e}`);
					});
			} else if (
				settings.embeddingSettings.General.enabled &&
				settings.embeddingSettings.General.globPattern
			) {
				if (
					settings!.embeddingSettings[settings!.embeddingProvider]?.dimensions!
				) {
					if (!this.fileWatcher) {
						this.fileWatcher = new WingmanFileWatcher(this);
						await this.fileWatcher.initialize(
							this.settings?.embeddingSettings.General.globPattern!,
						);
					}
				}
			}
		} catch (e) {
			console.error(e);
		}

		return client.sendRequest("wingman/updateSettings");
	};

	deactivate = (): Thenable<void> | undefined => {
		if (!client) {
			return undefined;
		}

		if (this.fileWatcher) {
			this.fileWatcher.dispose();
		}

		return client.stop();
	};
}

const lspClient = new LSPClient();
export default lspClient;
