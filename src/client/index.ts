import * as vscode from "vscode";
import { ExtensionContext } from "vscode";
import {
	DocumentSymbol,
	LanguageClient,
	LanguageClientOptions,
	Location,
	LocationLink,
	ServerOptions,
	TransportKind,
} from "vscode-languageclient/node";
import { TypeRequestEvent } from "../server/retriever";
import { EmbeddingsResponse } from "../server";
import { Settings } from "@shared/types/Settings";
import { IndexerSettings } from "@shared/types/Indexer";
import { ComposerRequest, ComposerResponse } from "@shared/types/Composer";
import path from "node:path";
import ignore from "ignore";
import { mapLocation, mapSymbol } from "./utils";
import { loggingProvider } from "../providers/loggingProvider";
import {
	EVENT_COMPOSE_PHASE,
	EVENT_COMPOSE_STARTED,
	EVENT_FULL_INDEX_BUILD,
	EVENT_VECTOR_STORE_LOAD_FAILED,
	telemetry,
} from "../providers/telemetryProvider";
import { Workspace } from "../service/workspace";

let client: LanguageClient;

export class LSPClient {
	composerWebView: vscode.Webview | undefined;
	settings: Settings | undefined;

	activate = async (
		context: ExtensionContext,
		settings: Settings | undefined,
		workspace: Workspace
	) => {
		this.settings = settings;
		const serverModule = vscode.Uri.joinPath(
			context.extensionUri,
			"out",
			"server.js"
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
				"Wingman Language Server"
			),
			initializationOptions: {
				settings,
				indexerSettings: (await workspace.load()).indexerSettings,
			},
		};

		client = new LanguageClient(
			"WingmanLSP",
			"Wingman Language Server",
			serverOptions,
			clientOptions
		);

		// Start the client. This will also launch the server
		await client.start();

		client.onRequest("wingman/compose", (params: ComposerResponse) => {
			loggingProvider.logInfo(JSON.stringify(params));
			telemetry.sendEvent(EVENT_COMPOSE_PHASE, {
				phase: params.node,
			});
			this.composerWebView?.postMessage({
				command: "compose-response",
				value: params,
			});
		});

		client.onRequest(
			"wingman/failedLoadingStore",
			(params: ComposerResponse) => {
				telemetry.sendEvent(EVENT_VECTOR_STORE_LOAD_FAILED);
				vscode.window.showErrorMessage(
					"Unable to load vector index. It may be corrupt, if this continues please delete the index and re-create it."
				);
			}
		);

		client.onRequest("wingman/provideDocumentSymbols", async (params) => {
			if (!params.uri) {
				return [];
			}

			const document = await vscode.workspace.openTextDocument(
				vscode.Uri.parse(params.uri)
			);
			const symbols = await vscode.commands.executeCommand<
				DocumentSymbol[]
			>("vscode.executeDocumentSymbolProvider", document.uri);
			return symbols?.map((s) => mapSymbol(s)) || [];
		});

		client.onRequest(
			"wingman/provideDefinition",
			async (params: TypeRequestEvent) => {
				const document = await vscode.workspace.openTextDocument(
					vscode.Uri.parse(params.uri)
				);
				const locations = await vscode.commands.executeCommand<
					(Location | LocationLink)[]
				>(
					"vscode.executeDefinitionProvider",
					document.uri,
					params.position
				);
				return locations?.map((l) => mapLocation(l)) || [];
			}
		);

		client.onRequest(
			"wingman/provideTypeDefiniton",
			async (params: TypeRequestEvent) => {
				const document = await vscode.workspace.openTextDocument(
					vscode.Uri.parse(params.uri)
				);
				const locations = await vscode.commands.executeCommand<
					(Location | LocationLink)[]
				>(
					"vscode.executeTypeDefinitionProvider",
					document.uri,
					params.position
				);
				return locations?.map((l) => mapLocation(l)) || [];
			}
		);
	};

	setComposerWebViewReference = (webview: vscode.Webview) => {
		this.composerWebView = webview;
	};

	setIndexerSettings = async (indexSettings: IndexerSettings) => {
		await client.sendRequest("wingman/indexerSettings", indexSettings);
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
		await client.sendRequest<ComposerResponse>("wingman/compose", {
			request,
		});
	};

	clearChatHistory = async () => {
		await client.sendRequest("wingman/clearChatHistory");
	};

	buildFullIndex = async ({
		indexFilter,
		exclusionFilter,
	}: IndexerSettings) => {
		telemetry.sendEvent(EVENT_FULL_INDEX_BUILD);
		const foundFiles = await findFiles(indexFilter, exclusionFilter);
		return client.sendRequest("wingman/fullIndexBuild", {
			files: foundFiles.map((f) => f.fsPath),
		});
	};

	deleteIndex = async () => {
		return client.sendRequest("wingman/deleteIndex");
	};

	cancelComposer = async () => {
		return client.sendRequest("wingman/cancelComposer");
	};

	deleteFileFromIndex = async (filePath: string) => {
		return client.sendRequest("wingman/deleteFileFromIndex", {
			filePath
		});
	}

	getEmbeddings = async (query: string): Promise<EmbeddingsResponse> => {
		try {
			return client.sendRequest("wingman/getEmbeddings", {
				query,
			});
		} catch (e) {
			loggingProvider.logError(e);
		}

		return { codeDocs: [], projectDetails: "" };
	};

	indexExists = async () => {
		return client.sendRequest("wingman/getIndex");
	};

	deactivate = (): Thenable<void> | undefined => {
		if (!client) {
			return undefined;
		}
		return client.stop();
	};
}

async function getGitignorePatterns(exclusionFilter?: string) {
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders) {
        return "";
    }

    const gitignorePath = vscode.Uri.file(
        path.join(workspaceFolders[0].uri.fsPath, ".gitignore")
    );

    try {
        const gitignoreContent = await vscode.workspace.fs.readFile(
            gitignorePath
        );
        const gitignoreLines = gitignoreContent.toString().split("\n");
        const ig = ignore().add(gitignoreLines);

        // Use the ignore instance to filter and process patterns
        const gitIgnorePatterns = gitignoreLines
            .filter((line) => line && !line.startsWith("#"))
            .map((pattern) => {
                // Verify if the pattern is valid using the ignore instance
                if (ig.ignores(pattern.replace(/^!/, ''))) {
                    if (pattern.startsWith("!")) {
                        return `!**/${pattern.slice(1)}`;
                    }
                    return `**/${pattern}`;
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
            loggingProvider.logError(
                `Error reading .gitignore file: ${err.message}`
            );
        }
        return "";
    }
}

async function findFiles(filter: string, exclusionFilter?: string) {
	const combinedExclusionFilter = await getGitignorePatterns(exclusionFilter);

	const files = await vscode.workspace.findFiles(
		filter,
		combinedExclusionFilter
	);
	return files;
}

const lspClient = new LSPClient();
export default lspClient;
