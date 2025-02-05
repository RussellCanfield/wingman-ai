import {
	createConnection,
	TextDocuments,
	ProposedFeatures,
	InitializeParams,
	DidChangeConfigurationNotification,
	TextDocumentSyncKind,
	InitializeResult,
	DocumentDiagnosticReportKind,
	type DocumentDiagnosticReport,
	DidChangeWorkspaceFoldersNotification,
} from "vscode-languageserver/node";
import { URI } from "vscode-uri";
import { TextDocument } from "vscode-languageserver-textdocument";
import { Store } from "../store/vector";
import { CodeGraph } from "./files/graph";
import { CodeParser } from "./files/parser";
import { Indexer } from "./files/indexer";
import { Generator } from "./files/generator";
import { createSymbolRetriever, SymbolRetriever } from "./retriever";
import { DocumentQueue } from "./queue";
import {
	clearFilterCache,
	filePathToUri,
} from "./files/utils";
import { VectorQuery } from "./query";
import { ProjectDetailsHandler } from "./project-details";
import { MemorySaver } from "@langchain/langgraph";
import { cancelComposer, ComposerGraph } from "../composer/v2/composer";
import { AIProvider } from "../service/base";
import {
	EmbeddingProviders,
	OllamaEmbeddingSettingsType,
	OpenAIEmbeddingSettingsType,
	Settings,
} from "@shared/types/Settings";
import { CreateAIProvider } from "../service/utils/models";
import { ComposerRequest, IndexStats, PlanExecuteState } from "@shared/types/v2/Composer";
import { loggingProvider } from "./loggingProvider";
import { createEmbeddingProvider } from "../service/embeddings/base";
import { IndexerSettings } from "@shared/types/Indexer";
import { LSPFileEventHandler } from "./files/eventHandler";
import { FileMetadata } from "@shared/types/v2/Message";
import { WebCrawler } from "./web";
import { promises } from "node:fs";
import path from "node:path";

const config = { configurable: { thread_id: "conversation-num-1" } };

let memory = new MemorySaver();
let modelProvider: AIProvider;
let embeddingProvider: EmbeddingProviders;
let embeddingSettings:
	| OllamaEmbeddingSettingsType
	| OpenAIEmbeddingSettingsType;
let settings: Settings;
let indexerSettings: IndexerSettings;

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
	vectorStore: Store | undefined;
	codeParser: CodeParser | undefined;
	symbolRetriever: SymbolRetriever | undefined;
	documentQueue: TextDocument[] = [];
	codeGraph: CodeGraph | undefined;
	connection: ReturnType<typeof createConnection> | undefined;
	queue: DocumentQueue | undefined;
	indexer: Indexer | undefined;
	composer: ComposerGraph | undefined;
	projectDetails: ProjectDetailsHandler | undefined;
	fileEventHandler: LSPFileEventHandler | undefined;
	// Create a simple text document manager.
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
		console.log("Wingman LSP initialized for workspace:", workspaceFolder);
		this.vectorStore = new Store(
			workspaceFolder,
			createEmbeddingProvider(embeddingProvider, embeddingSettings)
		);
		const { result, codeGraph } = await this.vectorStore?.initialize();
		if (!result) {
			await this.connection?.sendRequest("wingman/failedLoadingStore");
		}

		this.codeGraph = codeGraph;
		this.codeParser = new CodeParser(this.symbolRetriever!);
		const codeGenerator = new Generator(this.codeParser!, modelProvider);
		this.indexer = new Indexer(
			workspaceFolder,
			this.codeParser!,
			this.codeGraph!,
			codeGenerator,
			this.symbolRetriever!,
			this.vectorStore!,
			indexerSettings.indexFilter,
			this.updateFileInComposerGraph,
			this.removeFileInComposerGraph
		);

		this.composer = new ComposerGraph(
			this.workspaceFolders[0],
			modelProvider,
			this.codeGraph!,
			this.vectorStore!,
			settings.validationSettings,
			config,
			memory
		)

		await this.codeParser.initialize();

		this.queue = new DocumentQueue(this.indexer);

		this.projectDetails = new ProjectDetailsHandler(
			this.workspaceFolders[0],
			codeGenerator
		);
		await this.projectDetails.generateProjectDetails();

		if (embeddingSettings.enabled) {
			await this.vectorStore.createIndex();
		}
	};

	private removeFileInComposerGraph = async (relativeFilePath: string) => {
		if (!this.composer) {
			return;
		}

		const file: FileMetadata = {
			path: relativeFilePath
		}

		await this.composer.removeFile(file);

		await this.connection?.sendNotification("wingman/index-updated", {
			exists: (await this.vectorStore?.indexExists()) ?? false,
			processing: this.indexer?.isSyncing() ?? false,
			files: Array.from(
				this.codeGraph?.getSymbolTable().keys() ?? []
			),
		} satisfies IndexStats);
	}

	private updateFileInComposerGraph = async (relativeFilePath: string) => {
		if (!this.composer) {
			return;
		}

		const file: FileMetadata = {
			path: relativeFilePath,
			code: await promises.readFile(path.join(this.workspaceFolders[0], relativeFilePath), 'utf-8'),
			lastModified: Date.now()
		}

		await this.composer.updateFile(file);

		await this.connection?.sendNotification("wingman/webSearchProgress", {
			type: "complete"
		});
	}

	private initialize = () => {
		let hasConfigurationCapability = false;
		let hasWorkspaceFolderCapability = false;

		this.connection?.onInitialize(async (params: InitializeParams) => {
			if (params.workspaceFolders) {
				this.workspaceFolders = params.workspaceFolders.map(
					(folder) => URI.parse(folder.uri).fsPath
				);
			}

			const initializationOptions = params.initializationOptions;

			if (initializationOptions) {
				settings = initializationOptions.settings as Settings;

				if (!settings) {
					throw new Error("Settings not found");
				}

				embeddingProvider = settings.embeddingProvider;

				if (settings.embeddingProvider === "Ollama") {
					embeddingSettings = settings.embeddingSettings.Ollama!;
				} else if (settings.embeddingProvider === "OpenAI") {
					embeddingSettings = settings.embeddingSettings.OpenAI!;
				} else if (settings.embeddingProvider === "AzureAI") {
					embeddingSettings = settings.embeddingSettings.AzureAI!;
				}
			}

			indexerSettings =
				initializationOptions.indexerSettings as IndexerSettings;

			this.connection?.console.log(
				"Workspace folders: " + this.workspaceFolders.join(", ")
			);

			const capabilities = params.capabilities;

			// Does the client support the `workspace/configuration` request?
			// If not, we fall back using global settings.
			hasConfigurationCapability = !!(
				capabilities.workspace && !!capabilities.workspace.configuration
			);
			hasWorkspaceFolderCapability = !!(
				capabilities.workspace &&
				!!capabilities.workspace.workspaceFolders
			);
			const result: InitializeResult = {
				capabilities: {
					textDocumentSync: {
						change: TextDocumentSyncKind.Incremental,
						save: {
							includeText: true,
						},
					}
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
							filters: [{ pattern: { glob: "**/*" } }]
						},
						didRename: {
							filters: [{ pattern: { glob: "**/*" } }]
						}
					}
				};
			}

			return result;
		});

		this.connection?.onInitialized(async () => {
			if (hasConfigurationCapability) {
				// Register for all configuration changes.
				this.connection?.client.register(
					DidChangeConfigurationNotification.type,
					undefined
				);
			}
			if (hasWorkspaceFolderCapability) {
				this.connection?.workspace.onDidChangeWorkspaceFolders(
					(_event) => {
						this.connection?.console.log(
							"Workspace folder change event received."
						);
					}
				);
			}

			try {
				await this.postInitialize();

				this.fileEventHandler = new LSPFileEventHandler(
					//@ts-expect-error
					this.connection,
					this.workspaceFolders,
					this.queue,
					indexerSettings.indexFilter,
					this.vectorStore
				);

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

	private executeComposer = async (request: ComposerRequest) => {
		if (!this.composer) {
			return;
		}

		const generator = this.composer.execute(
			request
		);

		for await (const { node, values } of generator) {
			if (node === "composer-files-done") {
				const { files } = values as PlanExecuteState;

				if (files && files.length > 0) {
					//Add new files to the queue since they don't trigger events
					const fileUris = files
						.filter(f => !f.original)
						.map(f => filePathToUri(path.join(this.workspaceFolders[0], f.path)));

					if (fileUris.length > 0) {
						this.queue?.enqueue(fileUris); 55
					}
				}
			}
			await this.connection?.sendRequest("wingman/compose", {
				node,
				values,
			});
		}
	}

	private addEvents = async () => {
		this.connection?.languages.diagnostics.on(async (params) => {
			const document = this.documents.get(params.textDocument.uri);
			if (document !== undefined) {
				return {
					kind: DocumentDiagnosticReportKind.Full,
					items: [],
				} satisfies DocumentDiagnosticReport;
			} else {
				// We don't know the document. We can either try to read it from disk
				// or we don't report problems for it.
				this.connection?.console.log(
					`Document not found: ${params.textDocument.uri}`
				);
				return {
					kind: DocumentDiagnosticReportKind.Full,
					items: [],
				} satisfies DocumentDiagnosticReport;
			}
		});

		this.connection?.onDidChangeConfiguration((change) => {
			this.connection?.languages.diagnostics.refresh();
		});

		this.connection?.onNotification(
			DidChangeWorkspaceFoldersNotification.type,
			(params) => {
				params.event.added.forEach((folder) => {
					const folderPath = URI.parse(folder.uri).fsPath;
					if (!this.workspaceFolders.includes(folderPath)) {
						this.workspaceFolders.push(folderPath);
						this.connection?.console.log(
							`Workspace folder added: ${folderPath}`
						);
					}
				});

				params.event.removed.forEach((folder) => {
					const folderPath = URI.parse(folder.uri).fsPath;
					const index = this.workspaceFolders.indexOf(folderPath);
					if (index !== -1) {
						this.workspaceFolders.splice(index, 1);
						this.connection?.console.log(
							`Workspace folder removed: ${folderPath}`
						);
					}
				});
			}
		);

		this.connection?.onRequest("wingman/getIndex", async () => {
			return {
				exists: (await this.vectorStore?.indexExists()) ?? false,
				processing: this.indexer?.isSyncing() ?? false,
				files: Array.from(
					this.codeGraph?.getSymbolTable().keys() ?? []
				),
			} satisfies IndexStats;
		});

		this.connection?.onRequest(
			"wingman/indexerSettings",
			(indexSettings: IndexerSettings) => {
				clearFilterCache();
				indexerSettings = indexSettings;

				if (this.fileEventHandler) {
					try {
						this.fileEventHandler.dispose();
					} catch { }
				}

				this.fileEventHandler = new LSPFileEventHandler(
					//@ts-expect-error
					this.connection,
					this.workspaceFolders,
					this.queue,
					indexerSettings.indexFilter,
					this.vectorStore
				);

				this.indexer?.setInclusionFilter(indexSettings.indexFilter);
				this.indexer?.clearCache();
			}
		);

		this.connection?.onRequest(
			"wingman/fullIndexBuild",
			async (request: { files: string[] }) => {
				try {
					if (!embeddingSettings?.enabled) {
						return;
					}

					clearFilterCache();
					const filePaths = request.files.map((file) =>
						filePathToUri(file)
					);
					this.connection?.console.log(
						`Starting full index build, with ${filePaths || 0
						} files`
					);

					await this.vectorStore?.createIndex();
					await this.indexer?.processDocuments(filePaths, true);
				} catch (e) {
					console.error("Full index failed:", e);
				}
			}
		);

		this.connection?.onRequest("wingman/deleteIndex", async () => {
			this.connection?.console.log("Received request to delete index");
			this.vectorStore?.deleteIndex();
			this.queue?.dispose();
			await this.postInitialize();
		});

		this.connection?.onRequest("wingman/clearChatHistory", () => {
			this.composer?.resetGraphState();
		});

		this.connection?.onRequest("wingman/cancelComposer", async () => {
			cancelComposer();
		});

		this.connection?.onRequest("wingman/deleteFileFromIndex", async ({ filePath }: { filePath: string }) => {
			await this.indexer?.deleteFile(filePath);
		})

		this.connection?.onRequest("wingman/compose", async ({ request }: { request: ComposerRequest }) => {
			await this.executeComposer(request);
		}
		);

		this.connection?.onRequest("wingman/acceptComposerFile", async (file: FileMetadata) => {
			const graphState = await this.composer?.acceptFile(file);

			const allFilesReviewed = graphState?.files?.every(f => f.accepted || f.rejected);

			if (allFilesReviewed) {
				this.executeComposer({
					input: "",
					contextFiles: []
				});
			}

			return graphState;
		});

		this.connection?.onRequest("wingman/rejectComposerFile", async (file: FileMetadata) => {
			const graphState = await this.composer?.rejectFile(file);

			const allFilesReviewed = graphState?.files?.every(f => f.accepted || f.rejected);

			if (allFilesReviewed) {
				this.executeComposer({
					input: "",
					contextFiles: []
				});
			}

			return graphState;
		});

		this.connection?.onRequest("wingman/undoComposerFile", async (file: FileMetadata) => {
			return this.composer?.undoFile(file);
		});

		this.connection?.onRequest("wingman/webSearch", async (input: string) => {
			const crawler = new WebCrawler(modelProvider);

			try {
				// Start the generator
				const generator = crawler.searchWeb(input);

				// Stream each chunk back to the client
				for await (const chunk of generator) {
					await this.connection?.sendNotification("wingman/webSearchProgress", {
						type: "progress",
						content: chunk
					});
				}

				// Signal completion
				await this.connection?.sendNotification("wingman/webSearchProgress", {
					type: "complete"
				});
			} catch (error) {
				await this.connection?.sendNotification("wingman/webSearchProgress", {
					type: "error",
					content: error instanceof Error ? error.message : "Unknown error occurred"
				});
			}
		});

		this.connection?.onRequest("wingman/getEmbeddings", async (request) => {
			try {
				this.connection?.console.log(
					"Received request for embeddings: " + request.query
				);

				const relatedDocuments = new VectorQuery();
				const docs =
					await relatedDocuments.retrieveDocumentsWithRelatedCode(
						request.query,
						this.codeGraph!,
						this.vectorStore!,
						this.workspaceFolders[0],
						3
					);

				const projectDetails =
					await this.projectDetails?.retrieveProjectDetails();

				this.connection?.console.log(
					`Found ${docs?.relatedCodeDocs.length} related documents`
				);

				return {
					codeDocs: docs.relatedCodeDocs,
					projectDetails: projectDetails?.description,
				};
			} catch (e) {
				console.error(e);
			}

			return {
				codeDocs: [],
				projectDetails: "",
			};
		});
	};
}

const lsp = new LSPServer();
export default lsp;
