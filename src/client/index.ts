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
	FileDiagnostic,
	GraphState,
} from "@shared/types/Composer";
import path from "node:path";
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

export class LSPClient {
	composerWebView: vscode.Webview | undefined;
	settings: Settings | undefined;

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
			connectionOptions: {
				maxRestartCount: 3,
			},
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
							diag.source === "eslint" || diag.source === "tslint",
					);

					// Now you can track or process these filtered diagnostics
					console.log(
						`File ${uri.toString()} has ${importIssues.length} import issues and ${lintingErrors.length} linting errors`,
					);

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

				return fileDiagnostics;
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
		files,
		threadId,
	}: UpdateComposerFileEvent): Promise<GraphState> => {
		return client.sendRequest("wingman/updateComposerFile", {
			files,
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

	updateMCPTools = async () => {
		return client.sendRequest("wingman/MCPUpdate");
	};

	deactivate = (): Thenable<void> | undefined => {
		if (!client) {
			return undefined;
		}
		return client.stop();
	};
}

const lspClient = new LSPClient();
export default lspClient;
