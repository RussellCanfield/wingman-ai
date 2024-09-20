import * as vscode from "vscode";
import {
	addNoneAttributeToLink,
	extractCodeBlock,
	replaceTextInDocument,
} from "./utilities";
import { DiffViewCommand } from "@shared/types/Composer";
import { AppMessage, FileMetadata } from "@shared/types/Message";

export class DiffViewProvider {
	panels: vscode.WebviewPanel[] = [];

	constructor(private readonly context: vscode.ExtensionContext) {}

	async createDiffView({ file, diff }: DiffViewCommand) {
		const currentPanel = vscode.window.createWebviewPanel(
			"diffWebView",
			`${file} - Diff View`,
			vscode.ViewColumn.One,
			{
				enableScripts: true,
			}
		);

		currentPanel.webview.html = await getWebViewHtml(
			this.context,
			currentPanel.webview
		);

		currentPanel.onDidDispose(() => {
			this.panels = this.panels.filter((panel) => panel !== currentPanel);
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
								theme: vscode.window.activeColorTheme.kind,
								file,
								diff,
								original: await vscode.workspace.fs
									.stat(vscode.Uri.file(file))
									.then(
										async () =>
											await vscode.workspace.fs
												.readFile(vscode.Uri.file(file))
												.then((buffer) =>
													buffer.toString()
												),
										() => "" // Return an empty string if the file does not exist
									),
							} satisfies DiffViewCommand,
						});
						break;
					case "accept-file-changes":
						const { file: artifactFile, code: markdown } =
							value as FileMetadata;
						let code = markdown?.startsWith("```")
							? extractCodeBlock(markdown)
							: markdown;
						const relativeFilePath =
							vscode.workspace.asRelativePath(artifactFile);

						// Get the workspace folder URI
						const workspaceFolder =
							vscode.workspace.workspaceFolders?.[0].uri;
						if (!workspaceFolder) {
							throw new Error("No workspace folder found");
						}

						// Construct the full URI of the file
						const fileUri = vscode.Uri.joinPath(
							workspaceFolder,
							relativeFilePath
						);

						try {
							// Check if the file exists
							await vscode.workspace.fs.stat(fileUri);

							// Check if the document is already open
							let document = vscode.workspace.textDocuments.find(
								(doc) =>
									doc.uri.toString() === fileUri.toString()
							);
							if (!document) {
								// Open the text document if it is not already open
								document =
									await vscode.workspace.openTextDocument(
										fileUri
									);
							}

							// Replace text in the document
							await replaceTextInDocument(document, code!, true);

							currentPanel.dispose();
						} catch (error) {
							if (
								(error as vscode.FileSystemError).code ===
								"FileNotFound"
							) {
								// Create the text document if it does not exist
								await vscode.workspace.fs.writeFile(
									fileUri,
									new Uint8Array()
								);
								const document =
									await vscode.workspace.openTextDocument(
										fileUri
									);
								await replaceTextInDocument(
									document,
									code!,
									true
								);
							} else {
								throw error;
							}
						}
						break;
				}
			}
		);
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
