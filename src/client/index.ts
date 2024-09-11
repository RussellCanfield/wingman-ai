import * as vscode from "vscode";
import { workspace, ExtensionContext } from "vscode";
import {
	DocumentSymbol,
	LanguageClient,
	LanguageClientOptions,
	Location,
	LocationLink,
	ServerOptions,
	TransportKind,
} from "vscode-languageclient/node";
import { Range } from "vscode-languageserver-textdocument";
import { TypeRequestEvent } from "../server/retriever";
import { EmbeddingsResponse } from "../server";
import { InteractionSettings, Settings } from "@shared/types/Settings";
import { ComposerRequest, ComposerResponse } from "@shared/types/Composer";

let client: LanguageClient;

const mapLocation = (location: Location | LocationLink) => {
	if ("targetUri" in location) {
		// Handle LocationLink
		return {
			uri: location.targetUri.toString(),
			range: {
				start: {
					line: location.targetRange.start.line,
					character: location.targetRange.start.character,
				},
				end: {
					line: location.targetRange.end.line,
					character: location.targetRange.end.character,
				},
			},
		};
	} else {
		// Handle Location
		return {
			uri: location.uri.toString(),
			range: {
				start: {
					line: location.range.start.line,
					character: location.range.start.character,
				},
				end: {
					line: location.range.end.line,
					character: location.range.end.character,
				},
			},
		};
	}
};

const mapSymbol = (symbol: DocumentSymbol): DocumentSymbol => ({
	name: symbol.name,
	kind: symbol.kind,
	range: mapRange(symbol.range),
	selectionRange: mapRange(symbol.selectionRange),
	children: symbol.children
		? symbol.children.map((child) => ({
				name: child.name,
				kind: child.kind,
				range: mapRange(child.range),
				selectionRange: mapRange(child.selectionRange),
				children: [], // Assuming no nested children for simplicity
		  }))
		: [],
});

const mapRange = (range: Range): Range => ({
	start: {
		line: range.start.line,
		character: range.start.character,
	},
	end: {
		line: range.end.line,
		character: range.end.character,
	},
});

export class LSPClient {
	composerWebView: vscode.Webview | undefined;

	activate = async (
		context: ExtensionContext,
		settings: Settings | undefined,
		aiProvider: string | undefined,
		embeddingProvider: string | undefined,
		embeddingSettings: Settings | undefined,
		interactionSettings: InteractionSettings
	) => {
		// The server is implemented in node
		const serverModule = vscode.Uri.joinPath(
			context.extensionUri,
			"out",
			"server",
			"index.js"
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

		// Options to control the language client
		const clientOptions: LanguageClientOptions = {
			// Register the server for plain text documents
			documentSelector: [{ scheme: "file", language: "*" }],
			// synchronize: {
			// 	// Notify the server about file changes to '.clientrc files contained in the workspace
			// 	fileEvents: workspace.createFileSystemWatcher("**/.clientrc"),
			// },
			outputChannel: vscode.window.createOutputChannel(
				"Wingman Language Server"
			),
			initializationOptions: {
				aiProvider,
				embeddingProvider,
				embeddingSettings,
				settings,
				interactionSettings,
			},
		};

		//await client.setTrace(2);

		// Create the language client and start the client.
		client = new LanguageClient(
			"WingmanLSP",
			"Wingman Language Server",
			serverOptions,
			clientOptions
		);

		// Start the client. This will also launch the server
		await client.start();

		client.onRequest("wingman/compose", (params: ComposerResponse) => {
			console.log(params);
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

	compose = async (request: ComposerRequest) => {
		await client.sendRequest<ComposerResponse>("wingman/compose", {
			request,
		});
	};

	clearChatHistory = async () => {
		await client.sendRequest("wingman/clearChatHistory");
	};

	buildFullIndex = async (filter: string, exclusionFilter: string) => {
		const files = await vscode.workspace.findFiles(
			filter,
			!exclusionFilter ? undefined : exclusionFilter
		);
		return client.sendRequest("wingman/fullIndexBuild", {
			files,
		});
	};

	deleteIndex = async () => {
		return client.sendRequest("wingman/deleteIndex");
	};

	getEmbeddings = async (query: string): Promise<EmbeddingsResponse> => {
		return client.sendRequest("wingman/getEmbeddings", {
			query,
		});
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

const lspClient = new LSPClient();
export default lspClient;
