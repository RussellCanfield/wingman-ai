import { Connection, createConnection, DeleteFilesParams, DidChangeTextDocumentParams, DidChangeWatchedFilesParams, FileChangeType, RenameFilesParams } from "vscode-languageserver/node";
import { DocumentQueue } from "../queue";
import { Store } from "../../store/vector";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { minimatch } from 'minimatch';
import { Disposable } from "vscode-languageserver/node";
import { filePathToUri } from "./utils";

export class LSPFileEventHandler {
    private connection: ReturnType<typeof createConnection>;
    private workspaceFolders: string[];
    private queue: DocumentQueue;
    private inclusionFilter: string;
    private disposables: Disposable[] = [];

    constructor(
        connection: Connection,
        workspaceFolders: string[],
        queue: DocumentQueue,
        inclusionGlobFilter: string,
        private readonly vectorStore: Store
    ) {
        this.connection = connection;
        this.workspaceFolders = workspaceFolders;
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
        this.disposables.push(
            this.connection.workspace.onDidRenameFiles(async (event) => {
                await this.handleFileRename(event);
            })
        );

        this.disposables.push(
            this.connection.workspace.onDidDeleteFiles(async (event) => {
                await this.handleFileDelete(event);
            })
        );

        this.disposables.push(
            this.connection.onDidChangeTextDocument(async (event) => {
                await this.handleFileChanges(event);
            })
        );
    }

    private async handleFileRename(event: RenameFilesParams) {
        try {
            const filesToProcess = await Promise.all(
                event.files.filter(async file =>
                    await this.shouldProcessFile(fileURLToPath(file.oldUri)) &&
                    await this.shouldProcessFile(fileURLToPath(file.newUri))
                )
            );

            this.queue?.enqueue(filesToProcess.map((file) => file.newUri));
        } catch (error) {
            this.connection.console.error(`Error handling rename: ${error}`);
        } finally {
            return { changes: {} };
        }
    }

    private async handleFileDelete(event: DeleteFilesParams) {
        try {
            const filesToProcess = await Promise.all(
                event.files.map(async file => {
                    const filePath = fileURLToPath(file.uri);

                    // Check if this was a directory deletion
                    if (path.extname(filePath).length === 0) {
                        const folderPath = filePath.replace(/\/$/, ''); // Remove trailing slash
                        const filesInFolder = await this.vectorStore.getAllFilesByPrefix(folderPath);

                        if (filesInFolder.length > 0) {
                            // Convert file paths back to URIs
                            return filesInFolder.map(filePath => filePathToUri(filePath));
                        }
                        return null;
                    }

                    // Regular file deletion
                    if (await this.shouldProcessFile(filePath)) {
                        return [file.uri];
                    }

                    return null;
                })
            );

            const validFiles = filesToProcess
                .filter((files): files is string[] => files !== null)
                .flat();

            if (validFiles.length > 0) {
                this.queue?.enqueue(validFiles);
            }
        } catch (error) {
            this.connection.console.error(`Error handling delete: ${error}`);
        } finally {
            return { changes: {} };
        }
    }

    private async handleFileChanges(event: DidChangeTextDocumentParams) {
        try {
            if (!(await this.shouldProcessFile(fileURLToPath(event.textDocument.uri)))) return;

            this.queue?.enqueue([event.textDocument.uri]);
        } catch (error) {
            this.connection.console.error(`Error handling changes: ${error}`);
        }
    }

    public dispose(): void {
        this.disposables.forEach(disposable => disposable.dispose());
        this.disposables = [];
    }
}