import * as vscode from "vscode";
import { addNoneAttributeToLink } from "./utilities";
import { DiffViewCommand } from "@shared/types/Composer";

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

		currentPanel.webview.onDidReceiveMessage(async (message) => {
			if (message.command === "webviewLoaded") {
				currentPanel?.webview.postMessage({
					command: "diff-file",
					value: {
						theme: vscode.window.activeColorTheme.kind,
						file,
						diff,
						original: await vscode.workspace.fs
							.readFile(vscode.Uri.file(file))
							.then((buffer) => buffer.toString()),
					} satisfies DiffViewCommand,
				});
			}
		});
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
		await vscode.workspace.fs.readFile(vscode.Uri.file(htmlUri.path))
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
