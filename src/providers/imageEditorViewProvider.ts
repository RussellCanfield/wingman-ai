import * as vscode from "vscode";
import { addNoneAttributeToLink } from "./utilities";
import type { AppMessage } from "@shared/types/Message";
import type { LSPClient } from "../client";
import { wingmanSettings } from "../service/settings";
import { CreateAIProvider } from "../service/utils/models";
import { loggingProvider } from "./loggingProvider";

export class ImageEditorViewProvider {
	private panel: vscode.WebviewPanel | undefined;

	constructor(
		private readonly _context: vscode.ExtensionContext,
		private readonly _lspClient: LSPClient,
	) {}

	async openEditor(onSend: (imageData: string) => void) {
		if (this.panel) {
			this.panel.dispose();
		}

		this.panel = vscode.window.createWebviewPanel(
			"imageEditorView",
			"Canvas",
			vscode.ViewColumn.One,
			{
				enableScripts: true,
			},
		);

		this.panel.webview.html = await getWebViewHtml(
			this._context,
			this.panel.webview,
		);

		this.panel.webview.onDidReceiveMessage(async (message: AppMessage) => {
			if (!message) return;

			const { command, value } = message;

			switch (command) {
				case "generate-image": {
					try {
						const settings = await wingmanSettings.loadSettings();
						const ai = CreateAIProvider(settings, loggingProvider);
						if (!ai.generateImage) {
							break;
						}

						const contents = [
							{ text: "Make the image look real" },
							{
								inlineData: {
									mimeType: "image/png",
									data: String(value).split("data:image/png;base64,")[1],
								},
							},
						];

						this.panel?.webview.postMessage({
							command: "image-result",
							value: await ai.generateImage(contents),
						});
					} catch (e) {
						this.panel?.webview.postMessage({
							command: "image-failure",
							value: (e as Error).message,
						});
					}
					break;
				}
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
		vscode.Uri.joinPath(context.extensionUri, "out", "views", "image.html"),
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
