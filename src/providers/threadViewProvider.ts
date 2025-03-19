import * as vscode from "vscode";
import { addNoneAttributeToLink } from "./utilities";
import type { AppMessage } from "@shared/types/Message";
import type { WorkspaceSettings } from "@shared/types/Settings";
import type { LSPClient } from "../client";

export class ThreadViewProvider {
	private panel: vscode.WebviewPanel | undefined;

	constructor(
		private readonly _context: vscode.ExtensionContext,
		private readonly _lspClient: LSPClient,
	) {}

	async visualizeThreads(settings: WorkspaceSettings) {
		if (this.panel) {
			this.panel.dispose();
		}

		this.panel = vscode.window.createWebviewPanel(
			"threadWebView",
			"Threads",
			vscode.ViewColumn.One,
			{
				enableScripts: true,
			},
		);

		this.panel.webview.html = await getWebViewHtml(
			this._context,
			this.panel.webview,
		);

		const states = await Promise.all(
			settings.threadIds?.map((threadId) => {
				return this._lspClient.loadThread(threadId);
			}) ?? [],
		);

		this.panel.webview.onDidReceiveMessage(async (message: AppMessage) => {
			if (!message) return;

			const { command, value } = message;

			switch (command) {
				case "webviewLoaded":
					this.panel?.webview.postMessage({
						command: "thread-data",
						value: {
							states: states?.filter((s) => !!s.title),
							activeThreadId: settings.activeThreadId,
						},
					});
					break;
			}
		});
	}

	dispose = () => {
		this.panel?.dispose();
	};
}

async function getWebViewHtml(
	context: vscode.ExtensionContext,
	webview: vscode.Webview,
) {
	const nonce = getNonce();
	const htmlUri = webview.asWebviewUri(
		vscode.Uri.joinPath(context.extensionUri, "out", "views", "threads.html"),
	);
	const htmlContent = (
		await vscode.workspace.fs.readFile(vscode.Uri.file(htmlUri.fsPath))
	).toString();

	// Replace placeholders in the HTML content
	const finalHtmlContent = htmlContent.replace(/CSP_NONCE_PLACEHOLDER/g, nonce);

	const prefix = webview.asWebviewUri(
		vscode.Uri.joinPath(context.extensionUri, "out", "views"),
	);
	const srcHrefRegex = /(src|href)="([^"]+)"/g;

	// Replace the matched filename with the prefixed filename
	const updatedHtmlContent = finalHtmlContent.replace(
		srcHrefRegex,
		(match, attribute, filename) => {
			const prefixedFilename = `${prefix}${filename}`;
			return `${attribute}="${prefixedFilename}"`;
		},
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
            </script></body>`,
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
