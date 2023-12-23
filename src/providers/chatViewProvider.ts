import * as vscode from "vscode";
import { BaseModel } from "../service/llm";
import { AppMessage, ChatMessage } from "../types/Message";

const ChatHistoryKey = "ChatHistory";
const MaxChatHistoryTokens = 1200;

export class ChatViewProvider implements vscode.WebviewViewProvider {
	public static readonly viewType = "code-assistant-chat-view";

	private _disposables: vscode.Disposable[] = [];
	private _chatHistory: ChatMessage[] = [];

	constructor(
		private readonly _model: BaseModel,
		private readonly _context: vscode.ExtensionContext
	) {}

	dispose() {
		this._disposables.forEach((d) => d.dispose());
		this._disposables = [];
	}

	public resolveWebviewView(
		webviewView: vscode.WebviewView,
		_context: vscode.WebviewViewResolveContext,
		_token: vscode.CancellationToken
	) {
		webviewView.webview.options = {
			enableScripts: true,
			localResourceRoots: [this._context.extensionUri],
		};

		webviewView.webview.html = this.getHtmlForWebview(webviewView.webview);

		this.loadChatHistory();

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
				}
			})
		);
	}

	private async handleChatMessage({
		value,
		webviewView,
	}: Pick<AppMessage, "value"> & { webviewView: vscode.WebviewView }) {
		await this.addAndSaveToChatHistory({
			from: "User",
			message: value,
		});

		const { text, currentLine, language } = getChatContext();

		await this.streamChatResponse(
			value,
			`Chat History:
			${this._chatHistory.map((c) => `${c.from}: ${c.message}\n`).join("\n")}
			=======
			Context: The user is seeking coding advice using ${language}.
			
			Additional context: """${text}"""

			The most relevant context is as follows: """${currentLine}"""
			`,
			webviewView
		);
	}

	private async streamChatResponse(
		prompt: string,
		context: string,
		webviewView: vscode.WebviewView
	) {
		const response = await this._model.stream(prompt, context, {
			stream: true,
			additionalStopTokens: ["<|EOT|>", "<｜end▁of▁sentence｜>"],
		});

		const characterStream = response.body!.pipeThrough(
			new TextDecoderStream()
		) as unknown as AsyncIterable<string>;

		let message = "";

		for await (const chunks of characterStream) {
			const chunk = chunks.trimEnd().split(/\n/gm);

			for (const line of chunk) {
				const { response } = JSON.parse(line);

				message += response;

				//Streams don't serialize well here, just simplify it for now.
				webviewView.webview.postMessage({
					command: "response",
					value: response,
				});
			}
		}

		this._chatHistory.push({
			from: "Assistant",
			message: message,
		});

		webviewView.webview.postMessage({
			command: "done",
			value: null,
		});
	}

	private async addAndSaveToChatHistory(chatMessage: ChatMessage) {
		this._chatHistory.push(chatMessage);

		this._chatHistory = ensureChatHistorySizeAndTruncate(this._chatHistory);

		await this._context.workspaceState.update(
			ChatHistoryKey,
			this._chatHistory
		);
	}

	private async loadChatHistory() {
		const chatHistory =
			this._context.workspaceState.get<ChatMessage[]>(ChatHistoryKey);

		if (!chatHistory) {
			return;
		}

		this._chatHistory = chatHistory;

		return chatHistory;
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

function ensureChatHistorySizeAndTruncate(
	chatHistory: ChatMessage[]
): ChatMessage[] {
	if (!chatHistory) {
		return [];
	}

	let currentChatHistoryTokens = 0;
	let truncatedChatHistory: ChatMessage[] = [];

	for (const history of chatHistory) {
		currentChatHistoryTokens += history.message.length;

		if (currentChatHistoryTokens > MaxChatHistoryTokens) {
			break;
		}

		truncatedChatHistory.push(history);
	}

	return truncatedChatHistory;
}
