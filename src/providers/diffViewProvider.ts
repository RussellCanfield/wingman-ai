import * as vscode from "vscode";
import {
	addNoneAttributeToLink,
	extractCodeBlock,
	replaceTextInDocument,
} from "./utilities";
import {
	AppMessage,
	CodeReview,
	CodeReviewCommand,
	FileDetails,
	FileMetadata,
} from "@shared/types/Message";
import { AIProvider } from "../service/base";
import { CodeReviewer } from "../commands/review/codeReviewer";
import { LSPClient } from "../client";
import { DiffViewCommand } from "@shared/types/v2/Composer";

export class DiffViewProvider {
	panels: Map<string, vscode.WebviewPanel> = new Map();
	codeReviewer: CodeReviewer;

	constructor(
		private readonly _context: vscode.ExtensionContext,
		private readonly _aiProvider: AIProvider,
		private readonly _workspace: string,
		private readonly _lspClient: LSPClient
	) {
		this.codeReviewer = new CodeReviewer(this._workspace, this._aiProvider);
	}

	async createCodeReviewView(review: CodeReview) {
		if (this.panels.has(review.summary)) {
			const existingPanel = this.panels.get(review.summary);
			existingPanel?.reveal(vscode.ViewColumn.One);
			return;
		}

		const currentPanel = vscode.window.createWebviewPanel(
			"codeReview",
			`Code Review`,
			vscode.ViewColumn.One,
			{
				enableScripts: true,
				retainContextWhenHidden: true,
			}
		);

		this.panels.set(review.summary, currentPanel);

		currentPanel.webview.html = await getWebViewHtml(
			this._context,
			currentPanel.webview
		);

		currentPanel.onDidDispose(() => {
			this.panels.delete(review.summary);
		});

		currentPanel.webview.onDidReceiveMessage(
			async (message: AppMessage) => {
				if (!message) return;

				const { command, value } = message;

				switch (command) {
					case "webviewLoaded":
						currentPanel.webview.postMessage({
							command: "code-review",
							value: {
								isDarkTheme:
									vscode.window.activeColorTheme.kind !== 1,
								review: review,
							} satisfies CodeReviewCommand,
						});
						break;
					case "get-code-review-file":
						const fileReview = await this.reviewFile(
							value as FileDetails
						);
						currentPanel.webview.postMessage({
							command: "code-review-file-result",
							value: fileReview,
						});
						break;
				}
			}
		);
	}

	async createDiffView({ file, onAccept, onReject }: DiffViewCommand & { onAccept: (file: FileMetadata) => void, onReject: (file: FileMetadata) => void }) {
		if (this.panels.has(file.path)) {
			const existingPanel = this.panels.get(file.path);
			existingPanel?.reveal(vscode.ViewColumn.One);
			return;
		}

		const currentPanel = vscode.window.createWebviewPanel(
			"diffWebView",
			`${file.path} - Diff View`,
			vscode.ViewColumn.One,
			{
				enableScripts: true,
			}
		);

		this.panels.set(file.path, currentPanel);

		currentPanel.webview.html = await getWebViewHtml(
			this._context,
			currentPanel.webview
		);

		currentPanel.onDidDispose(() => {
			this.panels.delete(file.path);
		});

		currentPanel.webview.onDidReceiveMessage(
			async (message: AppMessage) => {
				if (!message) return;

				const { command, value } = message;

				switch (command) {
					case "webviewLoaded":
						currentPanel.webview.postMessage({
							command: "diff-file",
							value: {
								isDarkTheme:
									vscode.window.activeColorTheme.kind !== 1,
								file,
							} satisfies DiffViewCommand,
						});
						break;
					case "accept-file-changes":
						await this.acceptFileChanges(
							currentPanel,
							file.path,
							value as FileMetadata
						);
						onAccept(value as FileMetadata);
						break;
					case "reject-file-changes":
						onReject(value as FileMetadata);
						if (currentPanel) {
							currentPanel.dispose();
							this.panels.delete(file.path);
						}
						break;
				}
			}
		);
	}

	async reviewFile(fileDetails: FileDetails) {
		return this.codeReviewer.reviewFile(fileDetails);
	}

	async acceptFileChanges(
		currentPanel: vscode.WebviewPanel,
		file: string,
		{ path: artifactFile, code: markdown }: FileMetadata
	) {
		let code = markdown?.startsWith("```")
			? extractCodeBlock(markdown)
			: markdown;
		const relativeFilePath = vscode.workspace.asRelativePath(artifactFile);

		// Get the workspace folder URI
		const workspaceFolder = vscode.workspace.workspaceFolders?.[0].uri;
		if (!workspaceFolder) {
			throw new Error("No workspace folder found");
		}

		// Construct the full URI of the file
		const fileUri = vscode.Uri.joinPath(workspaceFolder, relativeFilePath);

		try {
			// Check if the file exists
			await vscode.workspace.fs.stat(fileUri);

			// Check if the document is already open
			let document = vscode.workspace.textDocuments.find(
				(doc) => doc.uri.toString() === fileUri.toString()
			);
			if (!document) {
				// Open the text document if it is not already open
				document = await vscode.workspace.openTextDocument(fileUri);
			}

			// Replace text in the document
			await replaceTextInDocument(document, code!, true);
		} catch (error) {
			if ((error as vscode.FileSystemError).code === "FileNotFound") {
				// Create the text document if it does not exist
				await vscode.workspace.fs.writeFile(fileUri, new Uint8Array());
				const document = await vscode.workspace.openTextDocument(
					fileUri
				);
				await replaceTextInDocument(document, code!, true);
			} else {
				throw error;
			}
		} finally {
			if (currentPanel) {
				currentPanel.dispose();
				this.panels.delete(file);
			}
		}
	}

	dispose() {
		this.panels.forEach((panel) => panel.dispose());
	}
}

async function getWebViewHtml(
	context: vscode.ExtensionContext,
	webview: vscode.Webview
) {
	const nonce = getNonce();
	const htmlUri = webview.asWebviewUri(
		vscode.Uri.joinPath(context.extensionUri, "out", "views", "diff.html")
	);
	const htmlContent = (
		await vscode.workspace.fs.readFile(vscode.Uri.file(htmlUri.fsPath))
	).toString();

	// Replace placeholders in the HTML content
	const finalHtmlContent = htmlContent.replace(
		/CSP_NONCE_PLACEHOLDER/g,
		nonce
	);

	const prefix = webview.asWebviewUri(
		vscode.Uri.joinPath(context.extensionUri, "out", "views")
	);
	const srcHrefRegex = /(src|href)="([^"]+)"/g;

	// Replace the matched filename with the prefixed filename
	const updatedHtmlContent = finalHtmlContent.replace(
		srcHrefRegex,
		(match, attribute, filename) => {
			const prefixedFilename = `${prefix}${filename}`;
			return `${attribute}="${prefixedFilename}"`;
		}
	);

	return addNoneAttributeToLink(updatedHtmlContent, nonce).replace(
		"</body>",
		`<script nonce="${nonce}">
(function() {
                    if (typeof vscode === 'undefined') {
                        window.vscode = acquireVsCodeApi();
                    }
                    window.addEventListener('load', () => {
                        window.vscode.postMessage({ command: 'webviewLoaded' });
                    });
                })();
            </script></body>`
	);
}

function getNonce() {
	let text = "";
	const possible =
		"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
	for (let i = 0; i < 32; i++) {
		text += possible.charAt(Math.floor(Math.random() * possible.length));
	}
	return text;
}
