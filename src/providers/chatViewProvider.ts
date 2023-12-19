import * as vscode from "vscode";
import { BaseModel } from "../service/llm";

export class ChatViewProvider implements vscode.WebviewViewProvider {
	public static readonly viewType = "code-assistant-chat-view";

	private _disposables: vscode.Disposable[] = [];
	private _model: BaseModel;

	constructor(model: BaseModel, private readonly _extensionUri: vscode.Uri) {
		this._model = model;
	}

	dispose() {
		this._disposables.forEach((d) => d.dispose());
		this._disposables = [];
	}

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

		this._disposables.push(
			webviewView.webview.onDidReceiveMessage((data) => {
				if (!data) {
					return;
				}

				const { command, value } = data;

				switch (command) {
					case "chat": {
						const { text, currentLine, language } =
							this._getCurrentFileContext();

						this.streamChatResponse(
							value,
							`The user is writing code using ${language}.

							The most relevant code: """${currentLine}"""
							Additional code to use as context: """${text}"""
							`,
							webviewView
						);

						break;
					}
				}
			})
		);
	}

	private async streamChatResponse(
		prompt: string,
		context: string,
		webviewView: vscode.WebviewView
	) {
		const response = await this._model.stream(prompt, context, {
			stream: true,
		});

		const characterStream = response.body!.pipeThrough(
			new TextDecoderStream()
		) as unknown as AsyncIterable<string>;

		for await (const chunks of characterStream) {
			const chunk = chunks.trimEnd().split(/\n/gm);

			for (const line of chunk) {
				const { response } = JSON.parse(line);

				//Streams don't serialize well here, just simplify it for now.
				webviewView.webview.postMessage({
					command: "response",
					value: response,
				});
			}
		}

		webviewView.webview.postMessage({
			command: "done",
			value: null,
		});
	}

	private _getCurrentFileContext() {
		const editor = vscode.window.activeTextEditor;
		if (!editor) {
			return { text: "", language: "" };
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
			currentLine: editor.document.lineAt(editor.selection.active.line)
				.text,
			language: editor.document.languageId,
		};
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
