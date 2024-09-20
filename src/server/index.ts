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
	FileOperationPatternKind,
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
import { filePathToUri, getWorkspaceFolderForDocument } from "./files/utils";
import { VectorQuery } from "./query";
import { ProjectDetailsHandler } from "./project-details";
import { MemorySaver } from "@langchain/langgraph";
import { generateCommand } from "../composer/composer";
import { AIProvider } from "../service/base";
import {
	InteractionSettings,
	OllamaEmbeddingSettingsType,
	OpenAIEmbeddingSettingsType,
	Settings,
} from "@shared/types/Settings";
import { CreateAIProvider } from "../service/utils/models";
import { ComposerRequest } from "@shared/types/Composer";
import { getOllamaEmbeddings } from "../service/embeddings/ollama";
import { getOpenAIEmbeddings } from "../service/embeddings/openai";
import { fileURLToPath } from "node:url";
import path from "node:path";

const config = { configurable: { thread_id: "conversation-num-1" } };

let memory = new MemorySaver();
let modelProvider: AIProvider;
let aiProvider: string;
let embeddingProvider: string;
let embeddingSettings:
	| OllamaEmbeddingSettingsType
	| OpenAIEmbeddingSettingsType;
let interactionSettings: InteractionSettings;
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
	vectorStore: Store | undefined;
	codeParser: CodeParser | undefined;
	symbolRetriever: SymbolRetriever | undefined;
	documentQueue: TextDocument[] = [];
	codeGraph: CodeGraph | undefined;
	connection: ReturnType<typeof createConnection> | undefined;
	queue: DocumentQueue | undefined;
	indexer: Indexer | undefined;
	projectDetails: ProjectDetailsHandler | undefined;
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
		modelProvider = CreateAIProvider(
			aiProvider,
			settings,
			interactionSettings
		);
		const workspaceFolder = this.workspaceFolders[0];
		this.vectorStore = new Store(
			workspaceFolder,
			embeddingProvider === "ollama"
				? getOllamaEmbeddings(
						embeddingSettings as OllamaEmbeddingSettingsType
				  )
				: getOpenAIEmbeddings(
						embeddingSettings as OpenAIEmbeddingSettingsType
				  )
		);
		const { codeGraph } = await this.vectorStore?.initialize();
		this.codeGraph = codeGraph;
		this.codeParser = new CodeParser(this.symbolRetriever!);
		const codeGenerator = new Generator(this.codeParser!, modelProvider);
		this.indexer = new Indexer(
			workspaceFolder,
			this.codeParser!,
			this.codeGraph!,
			codeGenerator,
			this.symbolRetriever!,
			this.vectorStore!
		);

		this.queue = new DocumentQueue(this.indexer);

		this.projectDetails = new ProjectDetailsHandler(
			this.workspaceFolders[0],
			codeGenerator
		);
		await this.projectDetails.generateProjectDetails();
	};

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
				aiProvider = initializationOptions.aiProvider;
				settings = initializationOptions.settings;
				interactionSettings = initializationOptions.interactionSettings;
				embeddingProvider = initializationOptions.embeddingProvider;
				embeddingSettings = initializationOptions.embeddingSettings;
			}

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
						openClose: true,
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
							filters: [
								{
									pattern: {
										glob: "**/*",
										matches: FileOperationPatternKind.file,
									},
								},
							],
						},
						didRename: {
							filters: [
								{
									pattern: {
										glob: "**/*",
										matches: FileOperationPatternKind.file,
									},
								},
							],
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

		this.connection?.workspace.onDidRenameFiles(async (event) => {
			const files = event.files.map((file) => {
				const absolutePath = fileURLToPath(file.oldUri);
				return path.relative(this.workspaceFolders[0], absolutePath);
			});

			const relatedDocs =
				(await this.vectorStore?.findDocumentsByPath(files)) || [];

			if (relatedDocs?.length > 0) {
				await this.vectorStore?.deleteDocuments(
					relatedDocs.map((doc) => doc.id!)
				);
			}

			this.queue?.enqueue(event.files.map((file) => file.newUri));

			return {
				changes: {},
			};
		});

		this.connection?.workspace.onDidDeleteFiles(async (event) => {
			const files = event.files.map((file) => {
				const absolutePath = fileURLToPath(file.uri);
				return path.relative(this.workspaceFolders[0], absolutePath);
			});

			const relatedDocs =
				(await this.vectorStore?.findDocumentsByPath(files)) || [];

			if (relatedDocs?.length > 0) {
				await this.vectorStore?.deleteDocuments(
					relatedDocs.map((doc) => doc.id!)
				);
			}

			return {
				changes: {},
			};
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
				exists: await this.vectorStore?.indexExists(),
				processing: this.indexer?.isSyncing(),
			};
		});

		this.connection?.onRequest(
			"wingman/fullIndexBuild",
			async (request: { files: { fsPath: string }[] }) => {
				this.connection?.console.log("Starting full index build");

				await this.vectorStore?.createIndex();
				await this.indexer?.processDocuments(
					request.files.map((file) => filePathToUri(file.fsPath)),
					true
				);
			}
		);

		this.connection?.onRequest("wingman/deleteIndex", async () => {
			this.connection?.console.log("Received request to delete index");
			this.vectorStore?.deleteIndex();
			this.queue?.dispose();
			await this.postInitialize();
		});

		this.connection?.onRequest("wingman/clearChatHistory", () => {
			memory = new MemorySaver();
		});

		this.connection?.onRequest(
			"wingman/compose",

			async ({ request }: { request: ComposerRequest }) => {
				const generator = generateCommand(
					this.workspaceFolders[0],
					request.input,
					modelProvider.getModel(),
					modelProvider.getRerankModel(),
					this.codeGraph!,
					this.vectorStore!,
					config,
					memory,
					request.contextFiles
				);

				for await (const { node, values } of generator) {
					console.log(values);
					await this.connection?.sendRequest("wingman/compose", {
						node,
						values,
					});
				}
			}
		);

		this.connection?.onRequest("wingman/getEmbeddings", async (request) => {
			this.connection?.console.log(
				"Received request for embeddings: " + request.query
			);

			const relatedDocuments = new VectorQuery();
			const docs =
				await relatedDocuments.retrieveDocumentsWithRelatedCode(
					request.query,
					this.codeGraph!,
					this.vectorStore!,
					this.workspaceFolders[0]
				);

			const projectDetails =
				await this.projectDetails?.retrieveProjectDetails();

			return {
				codeDocs: docs.relatedCodeDocs,
				projectDetails: projectDetails?.description,
			};
		});

		this.documents?.onDidSave((e) => {
			try {
				const document = e.document;
				const workspaceFolder = getWorkspaceFolderForDocument(
					document.uri,
					this.workspaceFolders
				);
				if (workspaceFolder) {
					this.connection?.console.log(
						"Document queued: " + document.uri
					);
					this.queue?.enqueue([document.uri]);
				}
			} catch (error) {
				console.log("On Document Save:", error, e);
			}
		});
	};
}

const lsp = new LSPServer();
export default lsp;
