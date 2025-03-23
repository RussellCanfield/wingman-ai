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
import {
	createDiagnosticsRetriever,
	createSymbolRetriever,
	type DiagnosticRetriever,
	type SymbolRetriever,
} from "./retriever";
import {
	ToolMessage,
	type ComposerRequest,
	type ComposerThread,
} from "@shared/types/Composer";
import { loggingProvider } from "./loggingProvider";
import path from "node:path";
import { cancelComposer, WingmanAgent } from "../composer";
import { PartitionedFileSystemSaver } from "../composer/checkpointer";
import type {
	FixDiagnosticsEvent,
	UpdateCommandEvent,
	UpdateComposerFileEvent,
} from "@shared/types/Events";
import { wingmanSettings } from "../service/settings";
import type { CommandMetadata, FileMetadata } from "@shared/types/Message";
import type { IndexFile } from "@shared/types/Settings";
import { VectorStore } from "./files/vector";
import type { Embeddings } from "@langchain/core/embeddings";
import {
	CreateAIProvider,
	CreateEmbeddingProvider,
} from "../service/utils/models";
import type { BaseChatModel } from "@langchain/core/language_models/chat_models";

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
	diagnosticsRetriever: DiagnosticRetriever;
	documentQueue: TextDocument[] = [];
	connection: ReturnType<typeof createConnection> | undefined;
	composer: WingmanAgent | undefined;
	documents: TextDocuments<TextDocument> = new TextDocuments(TextDocument);
	checkPointer: PartitionedFileSystemSaver | undefined;
	vectorStore: VectorStore | undefined;
	embedder: Embeddings | undefined;
	summaryModel: BaseChatModel | undefined;

	constructor() {
		// Create a connection for the server, using Node's IPC as a transport.
		// Also include all preview / proposed LSP features.
		this.connection = createConnection(ProposedFeatures.all);
		this.symbolRetriever = createSymbolRetriever(this.connection);
		this.diagnosticsRetriever = createDiagnosticsRetriever(this.connection);

		this.initialize();
	}

	private postInitialize = async () => {
		const workspaceFolder = this.workspaceFolders[0];

		loggingProvider.logInfo(
			`Wingman LSP initialized for workspace: ${workspaceFolder}`,
		);

		this.codeParser = new CodeParser(workspaceFolder, this.symbolRetriever);
		await this.codeParser.initialize();

		this.checkPointer = new PartitionedFileSystemSaver(
			this.getPersistancePath("checkpoints"),
		);

		const settings = await wingmanSettings.loadSettings();

		if (
			settings.embeddingSettings[settings.embeddingProvider]?.dimensions! &&
			settings.embeddingSettings.General.enabled
		) {
			this.vectorStore = new VectorStore(
				settings,
				this.workspaceFolders[0],
				this.getPersistancePath("embeddings"),
			);
			await this.vectorStore.initialize();
		}

		this.composer = new WingmanAgent(
			this.workspaceFolders[0],
			this.checkPointer,
			this.codeParser,
			this.vectorStore,
		);
		await this.composer.initialize();

		try {
			const provider = CreateAIProvider(settings, loggingProvider);

			if (settings.embeddingSettings.General.enabled) {
				this.embedder = CreateEmbeddingProvider(
					settings,
					loggingProvider,
				).getEmbedder();
				this.summaryModel = provider.getLightweightModel();
			}
		} catch (e) {
			console.error(e);
		}
	};

	private getPersistancePath = (folder: string) => {
		const homeDir = os.homedir();
		const targetPath = path.join(
			homeDir,
			".wingman",
			path.basename(this.workspaceFolders[0]),
			folder,
		);

		// Ensure the directory exists
		const dbDir = path.dirname(targetPath);
		fs.mkdirSync(dbDir, { recursive: true });

		return targetPath;
	};

	private compose = async (
		request: ComposerRequest,
		files?: FileMetadata[],
		command?: CommandMetadata,
		temp?: boolean,
	) => {
		try {
			if (!this.composer) return false;

			await this.composer.initialize();
			for await (const event of this.composer.execute(
				request,
				files,
				command,
				temp,
			)) {
				if (event.event === "no-op") {
					return false;
				}

				await this.connection?.sendRequest("wingman/compose", event);

				const settings = await wingmanSettings.loadSettings();
				if (
					event.event === "composer-done" &&
					!event.state.canResume &&
					event.state.messages &&
					settings.agentSettings.automaticallyFixDiagnostics
				) {
					try {
						const toolMessages = event.state.messages.filter(
							(m) => m instanceof ToolMessage && m.metadata && m.metadata.file,
						) as ToolMessage[];
						const files = toolMessages.map(
							(m) => m.metadata!.file as FileMetadata,
						);

						if (!files) return true;

						const diagnostics =
							await this.diagnosticsRetriever.getFileDiagnostics(
								files.map((f) => f.path) ?? [],
							);

						if (
							settings.agentSettings.automaticallyFixDiagnostics &&
							diagnostics &&
							diagnostics.length
						) {
							await this.fixDiagnostics({
								diagnostics: diagnostics,
								threadId: event.state.threadId,
							});
						}
					} catch (e) {
						console.error(e);
					}
				}
			}
		} catch (e) {
			console.error(e);
		}

		return true;
	};

	private fixDiagnostics = async (event: FixDiagnosticsEvent) => {
		const { threadId, diagnostics } = event;

		if (diagnostics?.length === 0) return;

		const aboslutePaths = diagnostics.map((d) => {
			if (path.isAbsolute(this.workspaceFolders[0])) return d.path;

			return path.join(this.workspaceFolders[0], d.path);
		});

		const input = diagnostics
			.map((d) => {
				return `<file_with_error>
Path: ${path.relative(this.workspaceFolders[0], d.path)}
${d.importErrors?.length > 0 ? d.importErrors.map((e) => `Import Error:${e.message}\nLine: ${e.start.line + 1}\nCharacter: ${e.start.character}`).join("\n") : ""}
${d.lintErrors?.length > 0 ? d.lintErrors.map((e) => `Linting Error: ${e.message}\nLine: ${e.start.line + 1}\nCharacter: ${e.start.character}`).join("\n") : ""}
</file_with_error>`;
			})
			.join("\n");

		return this.compose(
			{
				input: `The following files have import or linting errors, fix them all without making any breaking changes.
Each error type details the message, line it occurs on and character it starts at.

${input}`,
				contextFiles: aboslutePaths,
				recentFiles: [],
				threadId,
			},
			undefined,
			undefined,
			true,
		);
	};

	private initialize = async () => {
		let hasConfigurationCapability = false;
		let hasWorkspaceFolderCapability = false;

		this.connection?.onInitialize(async (params: InitializeParams) => {
			if (params.workspaceFolders) {
				this.workspaceFolders = params.workspaceFolders.map(
					(folder) => URI.parse(folder.uri).fsPath,
				);
			}

			this.connection?.console.log(
				`Workspace folders: ${this.workspaceFolders.join(", ")}`,
			);

			const capabilities = params.capabilities;

			await this.postInitialize();
			await this.addEvents();

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

		this.connection?.onShutdown(() => {
			loggingProvider.logInfo("LSP Server is shutting down.");
			if (this.checkPointer) {
				this.checkPointer.cleanup();
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
				return this.composer?.updateThread({
					thread: { id: threadId },
					messages: [],
				});
			},
		);

		this.connection?.onRequest("wingman/cancelComposer", async () => {
			cancelComposer();
		});

		this.connection?.onRequest(
			"wingman/compose",
			async ({ request }: { request: ComposerRequest }) => {
				return this.compose(request);
			},
		);

		this.connection?.onRequest(
			"wingman/fixDiagnostics",
			async (event: FixDiagnosticsEvent) => {
				return this.fixDiagnostics(event);
			},
		);

		this.connection?.onRequest("wingman/updateSettings", async () => {
			const settings = await wingmanSettings.loadSettings(true);
			await this.composer?.initialize();

			const provider = CreateAIProvider(settings, loggingProvider);

			if (settings.embeddingSettings.General.enabled) {
				this.embedder = CreateEmbeddingProvider(
					settings,
					loggingProvider,
				).getEmbedder();
				this.summaryModel = provider.getLightweightModel();
			}

			if (this.vectorStore) {
				const stats = await this.vectorStore.getStats();
				const embeddingSettings =
					settings.embeddingSettings[settings.embeddingProvider];
				if (
					embeddingSettings &&
					settings.embeddingSettings.General.enabled &&
					stats.dimensions !== embeddingSettings?.dimensions
				) {
					this.vectorStore.removeIndex();
					this.vectorStore = new VectorStore(
						settings,
						this.workspaceFolders[0],
						this.getPersistancePath("embeddings"),
					);
					await this.vectorStore.initialize();
				}
			} else if (
				!this.vectorStore &&
				settings.embeddingSettings.General.enabled
			) {
				this.vectorStore = new VectorStore(
					settings,
					this.workspaceFolders[0],
					this.getPersistancePath("embeddings"),
				);
				await this.vectorStore.initialize();
			}
		});

		this.connection?.onRequest(
			"wingman/getThreadById",
			async (threadId: string) => {
				// Race condition against LSP starting up and the client side retrieving history for chat panel
				if (!this.composer?.initialized) {
					const waitForInitialization = async () => {
						for (let attempt = 0; attempt < 20; attempt++) {
							await new Promise((resolve) => setTimeout(resolve, 250));
							if (this.composer?.initialized) {
								break;
							}
						}
					};
					await waitForInitialization();
					return this.composer?.getState(threadId);
				}
				return this.composer?.getState(threadId);
			},
		);

		this.connection?.onRequest(
			"wingman/indexFiles",
			async (indexFiles: [string, IndexFile][]) => {
				if (!this.vectorStore || !this.embedder || !this.summaryModel) return;

				for (const [filePath, metadata] of indexFiles) {
					if (!fs.existsSync(filePath)) continue;

					const fileContents = (
						await fs.promises.readFile(filePath)
					).toString();

					this.vectorStore.upsert(filePath, fileContents, metadata);
				}
			},
		);

		this.connection?.onRequest("wingman/getIndexedFiles", async () => {
			if (!this.vectorStore) return;

			return this.vectorStore.getIndexedFiles();
		});

		this.connection?.onRequest("wingman/resyncIndex", async () => {
			if (!this.vectorStore) return;

			return this.vectorStore.resync();
		});

		this.connection?.onRequest(
			"wingman/updateComposerFile",
			async (event: UpdateComposerFileEvent) => {
				const fromUserAction = event.files.every(
					(f) => f.accepted || f.rejected,
				);

				const resumed = await this.compose(
					{
						input: "",
						threadId: event.threadId,
						contextFiles: [],
					},
					event.files,
				);

				if (!fromUserAction || !resumed) {
					await this.composer?.updateFile(event);
				}

				return resumed;
			},
		);

		this.connection?.onRequest(
			"wingman/updateCommand",
			async (event: UpdateCommandEvent) => {
				const resumed = await this.compose(
					{
						input: "",
						threadId: event.threadId,
						contextFiles: [],
					},
					undefined,
					event.command,
				);

				return resumed;
			},
		);

		this.connection?.onRequest(
			"wingman/createThread",
			async (thread: ComposerThread) => {
				return this.composer?.createThread(thread);
			},
		);

		this.connection?.onRequest(
			"wingman/updateThread",
			async (thread: ComposerThread) => {
				return this.composer?.updateThread({ thread });
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
	};
}

const lsp = new LSPServer();
export default lsp;
