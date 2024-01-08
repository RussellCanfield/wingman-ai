import * as vscode from "vscode";
import { AppMessage, CodeContext, CodeContextDetails } from "../types/Message";
import { aiService } from "../service/ai.service";
import { BaseModel } from "../types/Models";
import { ModelProvider } from "../service/models/modelProvider";

let abortController = new AbortController();
let previousResponseContext: number[] = [];

export class ChatViewProvider implements vscode.WebviewViewProvider {
	public static readonly viewType = "wing-man-chat-view";

	private _disposables: vscode.Disposable[] = [];
	private _model: BaseModel;

	constructor(private readonly _context: vscode.ExtensionContext) {
		this._model = ModelProvider.createChatModelFromSettings();
	}

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
			localResourceRoots: [
				this._context.extensionUri,
				vscode.Uri.joinPath(
					this._context.extensionUri,
					"node_modules/vscode-codicons"
				),
			],
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
						vscode.env.clipboard.writeText(value as string);
						break;
					}
					case "copyToFile": {
						this.sendContentToNewDocument(value as string);
						break;
					}
					case "clear": {
						previousResponseContext = [];
						break;
					}
					case "showContext": {
						const { fileName, lineRange } = value as CodeContext;
						const [start, end] = lineRange.split("-").map(Number);
						const uri = vscode.Uri.file(fileName);
						vscode.window.showTextDocument(uri).then(() => {
							if (!vscode.window.activeTextEditor) {
								return;
							}

							vscode.window.activeTextEditor.selection =
								new vscode.Selection(
									new vscode.Position(start, 0),
									new vscode.Position(end, 0)
								);
						});
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

		await this.streamChatResponse(
			value as string,
			getChatContext(),
			webviewView
		);
	}

	private async streamChatResponse(
		prompt: string,
		context: CodeContextDetails | undefined,
		webviewView: vscode.WebviewView
	) {
		let ragContext = "";

		if (context) {
			const {
				text,
				currentLine,
				language,
				fileName,
				lineRange,
				workspaceName,
			} = context;

			ragContext = `The user is seeking coding advice using ${language}.
		Reference the following code context in order to provide a working solution.

		${text}

		=======

		The most important line of the code context is as follows: 
		
		${currentLine}
		
		=======
		`.replace(/\t/g, "");

			webviewView.webview.postMessage({
				command: "context",
				value: {
					fileName,
					lineRange,
					workspaceName,
				} satisfies CodeContext,
			});
		}

		const request = this._model.getChatPayload(
			prompt,
			ragContext,
			previousResponseContext
		);

		const response = await aiService.generate(
			request,
			abortController.signal
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

		const codiconsUri = webview.asWebviewUri(
			vscode.Uri.joinPath(
				this._context.extensionUri,
				"node_modules",
				"@vscode/codicons",
				"dist",
				"codicon.css"
			)
		);

		const nonce = getNonce();

		return `<!DOCTYPE html>
        <html lang="en" style="height: 100%">
          <head>
            <meta charset="UTF-8" />
            <meta name="viewport" content="width=device-width, initial-scale=1.0" />
            <meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'nonce-${nonce}'; font-src ${webview.cspSource}; style-src ${webview.cspSource} 'unsafe-inline';">
			<title>WingMan</title>
			<link rel="stylesheet" href="${codiconsUri}" nonce="${nonce}">
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

function getChatContext(): CodeContextDetails | undefined {
	const editor = vscode.window.activeTextEditor;
	if (!editor) {
		return undefined;
	}

	const lineWindow = 15;

	const { document, selection } = editor;
	let codeContextRange: vscode.Range;

	if (selection && !selection.isEmpty) {
		codeContextRange = new vscode.Range(
			selection.start.line,
			selection.start.character,
			selection.end.line,
			selection.end.character
		);
	} else {
		const currentLine = selection.active.line;
		const beginningWindowLine = document.lineAt(
			Math.max(0, currentLine - lineWindow)
		);
		const endWindowLine = document.lineAt(
			Math.min(document.lineCount - 1, currentLine + lineWindow)
		);
		codeContextRange = new vscode.Range(
			beginningWindowLine.range.start,
			endWindowLine.range.end
		);
	}

	const text = document.getText(codeContextRange);

	const documentUri = vscode.Uri.file(document.fileName);
	const workspaceFolder = vscode.workspace.getWorkspaceFolder(documentUri);

	return {
		text,
		currentLine: document.lineAt(selection.active.line).text,
		lineRange: `${codeContextRange.start.line}-${codeContextRange.end.line}`,
		fileName: document.fileName,
		workspaceName: workspaceFolder?.name ?? "",
		language: document.languageId,
	};
}
