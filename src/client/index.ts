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
import type { Settings } from "@shared/types/Settings";
import type {
	ComposerRequest,
	ComposerResponse,
	GraphState,
	IndexStats,
} from "@shared/types/v2/Composer";
import path from "node:path";
import ignore from "ignore";
import { mapLocation, mapSymbol } from "./utils";
import { loggingProvider } from "../providers/loggingProvider";
import {
	EVENT_COMPOSE_PHASE,
	EVENT_COMPOSE_STARTED,
	telemetry,
} from "../providers/telemetryProvider";
import type { Workspace } from "../service/workspace";
import type { UpdateComposerFileEvent } from "@shared/types/Events";

let client: LanguageClient;

export type IndexUpdateEvent = IndexStats;

export class IndexEventMediator {
	private listeners: Set<(stats: IndexUpdateEvent) => void> = new Set();

	subscribe(callback: (stats: IndexUpdateEvent) => void): () => void {
		this.listeners.add(callback);
		return () => this.listeners.delete(callback);
	}

	notify(stats: IndexUpdateEvent): void {
		// biome-ignore lint/complexity/noForEach: <explanation>
		this.listeners.forEach((listener) => listener(stats));
	}
}

export class LSPClient {
	composerWebView: vscode.Webview | undefined;
	settings: Settings | undefined;
	private indexMediator = new IndexEventMediator();

	onIndexUpdated(callback: (stats: IndexUpdateEvent) => void): () => void {
		return this.indexMediator.subscribe(callback);
	}

	activate = async (
		context: ExtensionContext,
		settings: Settings | undefined,
		workspace: Workspace,
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
			initializationOptions: {
				settings,
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

		client.onRequest("wingman/compose", (params: ComposerResponse) => {
			loggingProvider.logInfo(JSON.stringify(params));
			telemetry.sendEvent(EVENT_COMPOSE_PHASE, {
				phase: params.step,
			});
			this.composerWebView?.postMessage({
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

	clearChatHistory = async (activeThreadId: string) => {
		return client.sendRequest("wingman/clearChatHistory", activeThreadId);
	};

	updateComposerFile = async ({
		file,
		threadId,
	}: UpdateComposerFileEvent): Promise<GraphState> => {
		return client.sendRequest("wingman/updateComposerFile", { file, threadId });
	};

	fetchOriginalFileContents = async ({
		file,
		threadId,
	}: { file: string; threadId: string }): Promise<string> => {
		return client.sendRequest("wingman/fetchOriginalFileContents", {
			file,
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

	deleteThread = async (threadId: string) => {
		return client.sendRequest("wingman/deleteThread", threadId);
	};

	deleteIndex = async () => {
		return client.sendRequest("wingman/deleteIndex");
	};

	cancelComposer = async () => {
		return client.sendRequest("wingman/cancelComposer");
	};

	deactivate = (): Thenable<void> | undefined => {
		if (!client) {
			return undefined;
		}
		return client.stop();
	};

	public async *streamWebSearch(
		input: string,
	): AsyncGenerator<string | undefined, void, unknown> {
		// Create a queue to store incoming chunks
		const messageQueue: string[] = [];
		let isComplete = false;
		let error: Error | null = null;

		const completed = new Promise<void>((resolve, reject) => {
			// Store the disposable from the notification listener
			const disposable = client.onNotification(
				"wingman/webSearchProgress",
				(params: {
					type: "progress" | "complete" | "error";
					content?: string;
				}) => {
					if (params.type === "progress" && params.content) {
						messageQueue.push(params.content);
					} else if (params.type === "error") {
						error = new Error(params.content);
						isComplete = true;
						reject(error);
					} else if (params.type === "complete") {
						isComplete = true;
						resolve();
					}
				},
			);

			client.sendRequest("wingman/webSearch", input).catch((err) => {
				error = err;
				isComplete = true;
				reject(err);
			});

			// Clean up the listener when the promise settles
			Promise.resolve(completed).finally(() => {
				disposable.dispose();
			});
		});

		// Process the queue until completion
		while (!isComplete || messageQueue.length > 0) {
			if (messageQueue.length > 0) {
				yield messageQueue.shift();
			} else {
				await new Promise((resolve) => setTimeout(resolve, 50));
			}
		}

		if (error) {
			throw error;
		}

		await completed;
	}
}

async function getGitignorePatterns(exclusionFilter?: string) {
	const workspaceFolders = vscode.workspace.workspaceFolders;
	if (!workspaceFolders) {
		return "";
	}

	const gitignorePath = vscode.Uri.file(
		path.join(workspaceFolders[0].uri.fsPath, ".gitignore"),
	);

	try {
		const gitignoreContent = await vscode.workspace.fs.readFile(gitignorePath);
		const gitignoreLines = gitignoreContent.toString().split("\n");
		const ig = ignore().add(gitignoreLines);

		// Use the ignore instance to filter and process patterns
		const gitIgnorePatterns = gitignoreLines
			.filter((line) => line && !line.startsWith("#"))
			.map((pattern) => {
				// Remove leading slash if present
				const normalizedPattern = pattern.replace(/^\//, "");

				// Verify if the pattern is valid using the ignore instance
				if (ig.ignores(normalizedPattern.replace(/^!/, ""))) {
					if (normalizedPattern.startsWith("!")) {
						return `!**/${normalizedPattern.slice(1)}`;
					}
					return `**/${normalizedPattern}`;
				}
				return null;
			})
			.filter((pattern): pattern is string => pattern !== null);

		let combinedExclusionFilter: string | undefined;
		if (exclusionFilter) {
			combinedExclusionFilter = `{${exclusionFilter},${gitIgnorePatterns.join(",")}}`;
		} else if (gitIgnorePatterns.length > 0) {
			combinedExclusionFilter = `{${gitIgnorePatterns.join(",")}}`;
		}

		return combinedExclusionFilter;
	} catch (err) {
		if (err instanceof Error) {
			loggingProvider.logError(`Error reading .gitignore file: ${err.message}`);
		}
		return "";
	}
}

const lspClient = new LSPClient();
export default lspClient;
