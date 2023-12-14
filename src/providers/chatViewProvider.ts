import * as vscode from "vscode";
import { LlamaChatSession, Token } from "@node-llama";
import { BaseModel } from "../service/llm";

export class ChatViewProvider implements vscode.WebviewViewProvider {
	public static readonly viewType = "code-assistant-chat-view";

	private _disposables: vscode.Disposable[] = [];
	private _model: BaseModel;

	constructor(model: BaseModel, private readonly _extensionUri: vscode.Uri) {
		this._model = model;
	}

	// dispose() {
	// 	this._disposables.forEach((d) => d.dispose());
	// 	this._disposables = [];
	// }

	public resolveWebviewView(
		webviewView: vscode.WebviewView,
		context: vscode.WebviewViewResolveContext,
		_token: vscode.CancellationToken
	) {
		webviewView.webview.options = {
			// Allow scripts in the webview
			enableScripts: true,

			localResourceRoots: [this._extensionUri],
		};

		webviewView.webview.html = this._getHtmlForWebview(webviewView.webview);

		// webviewView.webview.onDidReceiveMessage((data) => {
		// 	if (!data) {
		// 		return;
		// 	}

		// 	switch (data.command) {
		// 		case "chat": {
		// 			const chatMessage = data.value;

		// 			this._model.prompt(chatMessage, {
		// 				onToken: (chunk: Uint32Array | Token[]) => {
		// 					webviewView.webview.postMessage({
		// 						command: "response",
		// 						value: this._model.context.decode(chunk),
		// 					});
		// 				},
		// 			});
		// 			break;
		// 		}
		// 	}
		// });
	}

	private _getHtmlForWebview(webview: vscode.Webview) {
		// Get the local path to main script run in the webview, then convert it to a uri we can use in the webview.
		const scriptUri = webview.asWebviewUri(
			vscode.Uri.joinPath(this._extensionUri, "out", "index.es.js")
		);

		const nonce = getNonce();

		return `<!DOCTYPE html>
        <html lang="en" style="height: 100%">
          <head>
            <meta charset="UTF-8" />
            <meta name="viewport" content="width=device-width, initial-scale=1.0" />
            <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; script-src 'nonce-${nonce}';">
            <title>Code Assistant</title>
          </head>
          <body style="height: 100%">
            <div id="root" style="height: 100%"></div>
            <script type="module" nonce="${nonce}" src="${scriptUri}"></script>
          </body>
        </html>`;
	}
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
