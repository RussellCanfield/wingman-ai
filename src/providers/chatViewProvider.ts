import * as vscode from "vscode";
import { AppMessage } from "../types/Message";
import { aiService } from "../service/ai.service";

let abortController = new AbortController();
let previousResponseContext: number[] = [];

export class ChatViewProvider implements vscode.WebviewViewProvider {
	public static readonly viewType = "code-assistant-chat-view";

	private _disposables: vscode.Disposable[] = [];

	constructor(private readonly _context: vscode.ExtensionContext) {}

	dispose() {
		this._disposables.forEach((d) => d.dispose());
		this._disposables = [];
	}

	public resolveWebviewView(
		webviewView: vscode.WebviewView,
		context: vscode.WebviewViewResolveContext,
		token: vscode.CancellationToken
	) {
		webviewView.webview.options = {
			enableScripts: true,
			localResourceRoots: [this._context.extensionUri],
		};

		webviewView.webview.html = this.getHtmlForWebview(webviewView.webview);

		token.onCancellationRequested((e) => {
			console.log(e);
			abortController.abort();
		});

		this._disposables.push(
			webviewView.webview.onDidReceiveMessage((data: AppMessage) => {
				if (!data) {
					return;
				}

				const { command, value } = data;

				switch (command) {
					case "chat": {
						this.handleChatMessage({ value, webviewView });
						break;
					}
					case "cancel": {
						abortController.abort();
						break;
					}
					case "clipboard": {
						vscode.env.clipboard.writeText(value);
						break;
					}
					case "copyToFile": {
						this.sendContentToNewDocument(value);
						break;
					}
					case "clear": {
						previousResponseContext = [];
						break;
					}
				}
			})
		);
	}

	private async sendContentToNewDocument(content: string) {
		const newFile = await vscode.workspace.openTextDocument({
			content,
		});
		vscode.window.showTextDocument(newFile);
	}

	private async handleChatMessage({
		value,
		webviewView,
	}: Pick<AppMessage, "value"> & { webviewView: vscode.WebviewView }) {
		abortController = new AbortController();

		const { text, currentLine, language } = getChatContext();

		await this.streamChatResponse(
			value,
			`The user is seeking coding advice using ${language}.
			Reference the following code in order to provide a working solution.
			"""${text}"""

			The most important line of code is as follows: """${currentLine}"""
			`,
			webviewView
		);
	}

	private async streamChatResponse(
		prompt: string,
		context: string,
		webviewView: vscode.WebviewView
	) {
		const response = await aiService.generate(
			prompt,
			abortController.signal,
			previousResponseContext,
			context
		);

		previousResponseContext = [];

		for await (const chunk of response) {
			const { response, context } = chunk;

			previousResponseContext = previousResponseContext.concat(context);

			webviewView.webview.postMessage({
				command: "response",
				value: response,
			});
		}

		webviewView.webview.postMessage({
			command: "done",
			value: null,
		});
	}

	private getHtmlForWebview(webview: vscode.Webview) {
		// Get the local path to main script run in the webview, then convert it to a uri we can use in the webview.
		const scriptUri = webview.asWebviewUri(
			vscode.Uri.joinPath(
				this._context.extensionUri,
				"out",
				"index.es.js"
			)
		);

		const nonce = getNonce();

		return `<!DOCTYPE html>
        <html lang="en" style="height: 100%">
          <head>
            <meta charset="UTF-8" />
            <meta name="viewport" content="width=device-width, initial-scale=1.0" />
            <meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'nonce-${nonce}'; font-src 'self'; style-src 'unsafe-inline';">
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

function getChatContext() {
	const editor = vscode.window.activeTextEditor;
	if (!editor) {
		return { text: "", currentLine: "", language: "" };
	}

	const lineWindow = 15;
	const currentLine = editor.selection.active.line;

	const beginningWindowLine = editor.document.lineAt(
		Math.max(0, currentLine - lineWindow)
	);
	const endWindowLine = editor.document.lineAt(
		Math.min(editor.document.lineCount - 1, currentLine + lineWindow)
	);

	const text = editor.document.getText(
		new vscode.Range(
			beginningWindowLine.range.start,
			endWindowLine.range.end
		)
	);

	return {
		text,
		currentLine: editor.document.lineAt(editor.selection.active.line).text,
		language: editor.document.languageId,
	};
}
