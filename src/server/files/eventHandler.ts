import { Connection, createConnection, DeleteFilesParams, DidChangeTextDocumentParams, DidChangeWatchedFilesParams, FileChangeType, RenameFilesParams } from "vscode-languageserver/node";
import { DocumentQueue } from "../queue";
import { Store } from "../../store/vector";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { minimatch } from 'minimatch';

export class LSPFileEventHandler {
    private connection: ReturnType<typeof createConnection>;
    private workspaceFolders: string[];
    private vectorStore: Store;
    private queue: DocumentQueue;
    private inclusionFilter: string;

    constructor(
        connection: Connection,
        workspaceFolders: string[],
        vectorStore: Store,
        queue: DocumentQueue,
        inclusionGlobFilter: string
    ) {
        this.connection = connection;
        this.workspaceFolders = workspaceFolders;
        this.vectorStore = vectorStore;
        this.queue = queue;
        this.inclusionFilter = inclusionGlobFilter;
        this.registerEventHandlers();
    }

    private async shouldProcessFile(filePath: string): Promise<boolean> {
        const relativePath = path.relative(this.workspaceFolders[0], filePath);

        try {
            return minimatch(relativePath, this.inclusionFilter, {
                dot: true,
                matchBase: true
            });
        } catch (error) {
            this.connection.console.error(`Error matching file patterns: ${error}`);
            return false;
        }
    }

    private registerEventHandlers() {
        this.connection.workspace.onDidRenameFiles(async (event) => {
            await this.handleFileRename(event);
        });

        this.connection.workspace.onDidDeleteFiles(async (event) => {
            await this.handleFileDelete(event);
        });

        this.connection.onDidChangeTextDocument(async (event) => {
            await this.handleFileChanges(event);
        });
    }

    private async handleFileRename(event: RenameFilesParams) {
        try {
            const filesToProcess = await Promise.all(
                event.files.filter(async file =>
                    await this.shouldProcessFile(fileURLToPath(file.oldUri))
                )
            );

            const files = filesToProcess.map((file) => {
                const absolutePath = fileURLToPath(file.oldUri);
                return path.relative(this.workspaceFolders[0], absolutePath);
            });

            const relatedDocs = await this.vectorStore?.findDocumentsByPath(files) || [];

            if (relatedDocs?.length > 0) {
                await this.vectorStore?.deleteDocuments(
                    relatedDocs.map((doc) => doc.id!)
                );
            }

            this.queue?.enqueue(filesToProcess.map((file) => file.newUri));

            return { changes: {} };
        } catch (error) {
            this.connection.console.error(`Error handling rename: ${error}`);
            return { changes: {} };
        }
    }

    private async handleFileDelete(event: DeleteFilesParams) {
        try {
            const filesToProcess = await Promise.all(
                event.files.filter(async file =>
                    await this.shouldProcessFile(fileURLToPath(file.uri))
                )
            );

            const files = filesToProcess.map((file) => {
                const absolutePath = fileURLToPath(file.uri);
                return path.relative(this.workspaceFolders[0], absolutePath);
            });

            const relatedDocs = await this.vectorStore?.findDocumentsByPath(files) || [];

            if (relatedDocs?.length > 0) {
                await this.vectorStore?.deleteDocuments(
                    relatedDocs.map((doc) => doc.id!)
                );
            }

            return { changes: {} };
        } catch (error) {
            this.connection.console.error(`Error handling delete: ${error}`);
            return { changes: {} };
        }
    }

    private async handleFileChanges(event: DidChangeTextDocumentParams) {
        try {
            if (!(await this.shouldProcessFile(fileURLToPath(event.textDocument.uri)))) return;

            await this.handleChanged(event.textDocument.uri);
        } catch (error) {
            this.connection.console.error(`Error handling changes: ${error}`);
        }
    }

    private async handleChanged(uri: string) {
        if (!await this.shouldProcessFile(fileURLToPath(uri))) {
            return;
        }

        this.queue?.enqueue([uri]);
    }
}