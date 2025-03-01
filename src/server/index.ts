import {
	createConnection,
	TextDocuments,
	ProposedFeatures,
	type InitializeParams,
	DidChangeConfigurationNotification,
	TextDocumentSyncKind,
	type InitializeResult,
	DocumentDiagnosticReportKind,
	type DocumentDiagnosticReport,
	DidChangeWorkspaceFoldersNotification,
} from "vscode-languageserver/node";
import fs from "node:fs";
import os from "node:os";
import { URI } from "vscode-uri";
import { TextDocument } from "vscode-languageserver-textdocument";
import { CodeParser } from "./files/parser";
import { createSymbolRetriever, type SymbolRetriever } from "./retriever";
import { emptyCheckpoint } from "@langchain/langgraph";
import type { AIProvider } from "../service/base";
import type { Settings } from "@shared/types/Settings";
import { CreateAIProvider } from "../service/utils/models";
import type { ComposerRequest } from "@shared/types/v2/Composer";
import { loggingProvider } from "./loggingProvider";
import { WebCrawler } from "./web";
import path from "node:path";
import { cancelComposer, WingmanAgent } from "../composer/v2/agents";
import { PartitionedFileSystemSaver } from "../composer/checkpointer";
import type { UpdateComposerFileEvent } from "@shared/types/Events";

let memory: PartitionedFileSystemSaver;
let modelProvider: AIProvider;
let settings: Settings;

export type CustomRange = {
	start: { line: number; character: number };
	end: { line: number; character: number };
};

export type CustomSymbol = {
	name: string;
	kind: number;
	range: CustomRange;
	selectionRange: CustomRange;
	children: CustomSymbol[] | undefined;
};

export type DocumentQueueEvent = {
	uri: string;
	languageId: string;
	symbols: CustomSymbol[];
};

export type EmbeddingsResponse = {
	codeDocs: string[];
	projectDetails: string;
};

export class LSPServer {
	workspaceFolders: string[] = [];
	codeParser: CodeParser | undefined;
	symbolRetriever: SymbolRetriever;
	documentQueue: TextDocument[] = [];
	connection: ReturnType<typeof createConnection> | undefined;
	composer: WingmanAgent | undefined;
	documents: TextDocuments<TextDocument> = new TextDocuments(TextDocument);

	constructor() {
		// Create a connection for the server, using Node's IPC as a transport.
		// Also include all preview / proposed LSP features.
		this.connection = createConnection(ProposedFeatures.all);
		this.symbolRetriever = createSymbolRetriever(this.connection);

		this.initialize();
	}

	private postInitialize = async () => {
		modelProvider = CreateAIProvider(settings, loggingProvider);
		const workspaceFolder = this.workspaceFolders[0];

		loggingProvider.logInfo(
			`Wingman LSP initialized for workspace: ${workspaceFolder}`,
		);

		this.codeParser = new CodeParser(workspaceFolder, this.symbolRetriever);
		await this.codeParser.initialize();

		memory = new PartitionedFileSystemSaver(this.getPersistancePath());
		this.composer = new WingmanAgent(
			modelProvider,
			this.workspaceFolders[0],
			settings,
			memory,
			this.codeParser,
		);
		await this.composer.initialize();
	};

	private getPersistancePath = () => {
		const homeDir = os.homedir();
		const targetPath = path.join(
			homeDir,
			".wingman",
			path.basename(this.workspaceFolders[0]),
			"checkpoints",
		);

		// Ensure the directory exists
		const dbDir = path.dirname(targetPath);
		fs.mkdirSync(dbDir, { recursive: true });

		return targetPath;
	};

	private initialize = () => {
		let hasConfigurationCapability = false;
		let hasWorkspaceFolderCapability = false;

		this.connection?.onInitialize(async (params: InitializeParams) => {
			if (params.workspaceFolders) {
				this.workspaceFolders = params.workspaceFolders.map(
					(folder) => URI.parse(folder.uri).fsPath,
				);
			}

			const initializationOptions = params.initializationOptions;

			if (initializationOptions) {
				settings = initializationOptions.settings as Settings;

				if (!settings) {
					throw new Error("Settings not found");
				}
			}

			this.connection?.console.log(
				`Workspace folders: ${this.workspaceFolders.join(", ")}`,
			);

			const capabilities = params.capabilities;

			// Does the client support the `workspace/configuration` request?
			// If not, we fall back using global settings.
			hasConfigurationCapability = !!(
				capabilities.workspace && !!capabilities.workspace.configuration
			);
			hasWorkspaceFolderCapability = !!(
				capabilities.workspace && !!capabilities.workspace.workspaceFolders
			);
			const result: InitializeResult = {
				capabilities: {
					textDocumentSync: {
						change: TextDocumentSyncKind.Incremental,
						save: {
							includeText: true,
						},
					},
				},
			};
			if (hasWorkspaceFolderCapability) {
				result.capabilities.workspace = {
					workspaceFolders: {
						supported: true,
						changeNotifications: true,
					},
					fileOperations: {
						didDelete: {
							filters: [{ pattern: { glob: "**/*" } }],
						},
						didRename: {
							filters: [{ pattern: { glob: "**/*" } }],
						},
					},
				};
			}

			return result;
		});

		this.connection?.onInitialized(async () => {
			if (hasConfigurationCapability) {
				// Register for all configuration changes.
				this.connection?.client.register(
					DidChangeConfigurationNotification.type,
					undefined,
				);
			}
			if (hasWorkspaceFolderCapability) {
				this.connection?.workspace.onDidChangeWorkspaceFolders((_event) => {
					this.connection?.console.log(
						"Workspace folder change event received.",
					);
				});
			}

			try {
				await this.postInitialize();
				await this.addEvents();
			} catch (e) {
				console.error(e);
			}
		});

		if (this.connection) {
			this.documents.listen(this.connection);
			this.connection?.listen();
		}
	};

	/**
	 * Sets up event listeners and request handlers for the language server connection.
	 *
	 * This method initializes various event handlers for:
	 * - Diagnostics reporting
	 * - Configuration changes
	 * - Workspace folder management
	 * - Index management and querying
	 * - Chat history management
	 * - Code composition and file operations
	 * - Web search functionality
	 * - Embedding retrieval
	 *
	 * @private
	 * @async
	 * @returns {Promise<void>} A promise that resolves when all event handlers are registered
	 */
	private addEvents = async () => {
		this.connection?.languages.diagnostics.on(async (params) => {
			const document = this.documents.get(params.textDocument.uri);
			if (document !== undefined) {
				return {
					kind: DocumentDiagnosticReportKind.Full,
					items: [],
				} satisfies DocumentDiagnosticReport;
			}
			// We don't know the document. We can either try to read it from disk
			// or we don't report problems for it.
			this.connection?.console.log(
				`Document not found: ${params.textDocument.uri}`,
			);
			return {
				kind: DocumentDiagnosticReportKind.Full,
				items: [],
			} satisfies DocumentDiagnosticReport;
		});

		this.connection?.onDidChangeConfiguration((change) => {
			this.connection?.languages.diagnostics.refresh();
		});

		this.connection?.onNotification(
			DidChangeWorkspaceFoldersNotification.type,
			(params) => {
				// biome-ignore lint/complexity/noForEach: <explanation>
				params.event.added.forEach((folder) => {
					const folderPath = URI.parse(folder.uri).fsPath;
					if (!this.workspaceFolders.includes(folderPath)) {
						this.workspaceFolders.push(folderPath);
						this.connection?.console.log(
							`Workspace folder added: ${folderPath}`,
						);
					}
				});

				// biome-ignore lint/complexity/noForEach: <explanation>
				params.event.removed.forEach((folder) => {
					const folderPath = URI.parse(folder.uri).fsPath;
					const index = this.workspaceFolders.indexOf(folderPath);
					if (index !== -1) {
						this.workspaceFolders.splice(index, 1);
						this.connection?.console.log(
							`Workspace folder removed: ${folderPath}`,
						);
					}
				});
			},
		);

		this.connection?.onRequest(
			"wingman/clearChatHistory",
			async (threadId: string) => {
				const existingThreadData = await memory.get({
					configurable: { thread_id: threadId },
				});

				if (existingThreadData) {
					await memory.put(
						{ configurable: { thread_id: threadId } },
						emptyCheckpoint(),
						{
							source: "update",
							step: 0,
							writes: {},
							parents: {},
						},
					);
				}
			},
		);

		this.connection?.onRequest("wingman/cancelComposer", async () => {
			cancelComposer();
		});

		this.connection?.onRequest(
			"wingman/compose",
			async ({ request }: { request: ComposerRequest }) => {
				try {
					for await (const event of this.composer!.execute(request)) {
						await this.connection?.sendRequest("wingman/compose", event);
					}
				} catch (e) {
					console.error(e);
				}
			},
		);

		this.connection?.onRequest(
			"wingman/updateComposerFile",
			async (event: UpdateComposerFileEvent) => {
				return this.composer?.updateFile(event);
			},
		);

		this.connection?.onRequest(
			"wingman/fetchOriginalFileContents",
			async ({ file, threadId }: { file: string; threadId: string }) => {
				return this.composer?.fetchOriginalFileContents(file, threadId);
			},
		);

		this.connection?.onRequest(
			"wingman/branchThread",
			async ({
				threadId,
				originalThreadId,
			}: { threadId: string; originalThreadId: string }) => {
				return this.composer?.branchThread(
					originalThreadId,
					undefined,
					threadId,
				);
			},
		);

		this.connection?.onRequest(
			"wingman/deleteThread",
			async (threadId: string) => {
				return this.composer?.deleteThread(threadId);
			},
		);

		this.connection?.onRequest("wingman/webSearch", async (input: string) => {
			const crawler = new WebCrawler(modelProvider);

			try {
				// Start the generator
				const generator = crawler.searchWeb(input);

				// Stream each chunk back to the client
				for await (const chunk of generator) {
					await this.connection?.sendNotification("wingman/webSearchProgress", {
						type: "progress",
						content: chunk,
					});
				}
				// Signal completion
				await this.connection?.sendNotification("wingman/webSearchProgress", {
					type: "complete",
				});
			} catch (error) {
				await this.connection?.sendNotification("wingman/webSearchProgress", {
					type: "error",
					content:
						error instanceof Error ? error.message : "Unknown error occurred",
				});
			}
		});
	};
}

const lsp = new LSPServer();
export default lsp;
