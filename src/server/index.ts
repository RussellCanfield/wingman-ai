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
import { emptyCheckpoint } from "@langchain/langgraph";
import type { ComposerRequest } from "@shared/types/Composer";
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
			this.getPersistancePath(),
		);

		this.composer = new WingmanAgent(
			this.workspaceFolders[0],
			this.checkPointer,
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

	private compose = async (
		request: ComposerRequest,
		files?: FileMetadata[],
		command?: CommandMetadata,
	) => {
		try {
			for await (const event of this.composer!.execute(
				request,
				files,
				command,
			)) {
				await this.connection?.sendRequest("wingman/compose", event);

				if (event.step === "composer-done" && !event.canResume) {
					const state = await this.composer?.getState(request.threadId);
					const settings = await wingmanSettings.LoadSettings(
						this.workspaceFolders[0],
					);
					const allFilesFinal = state?.files.every(
						(f) => f.accepted || f.rejected,
					);

					if (!allFilesFinal) return state;

					const diagnostics =
						await this.diagnosticsRetriever.getFileDiagnostics(
							state?.files.map((f) => f.path) ?? [],
						);

					if (settings.agentSettings.automaticallyFixDiagnostics) {
						if (diagnostics && diagnostics.length > 0) {
							await this.fixDiagnostics({
								diagnostics: diagnostics,
								threadId: event.threadId,
							});
						}
					}
				}
			}
		} catch (e) {
			console.error(e);
		}
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

		return this.compose({
			input: `The following files have import or linting errors, fix them all without making any breaking changes.
Each error type details the message, line it occurs on and character it starts at.

${input}`,
			contextFiles: aboslutePaths,
			recentFiles: [],
			threadId,
		});
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
				if (!this.checkPointer) return;

				const existingThreadData = await this.checkPointer.get({
					configurable: { thread_id: threadId },
				});

				if (existingThreadData) {
					await this.checkPointer.put(
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
			await wingmanSettings.LoadSettings(this.workspaceFolders[0], true);
			await this.composer?.initialize();
		});

		this.connection?.onRequest(
			"wingman/updateComposerFile",
			async (event: UpdateComposerFileEvent) => {
				const fromUserAction = event.files.every(
					(f) => f.accepted || f.rejected,
				);

				if (!fromUserAction) {
					return await this.composer?.updateFile(event);
				}

				if (event.files.every((f) => f.rejected)) {
					return await this.composer?.updateFile(event);
				}

				await this.compose(
					{
						input: "",
						threadId: event.threadId,
						contextFiles: [],
					},
					event.files,
				);
			},
		);

		this.connection?.onRequest(
			"wingman/updateCommand",
			async (event: UpdateCommandEvent) => {
				await this.compose(
					{
						input: "",
						threadId: event.threadId,
						contextFiles: [],
					},
					undefined,
					event.command,
				);
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
