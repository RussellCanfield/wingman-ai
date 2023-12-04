import * as vscode from "vscode";

interface CodeSuggestion {
	range: vscode.Range;
}

const decorationType = vscode.window.createTextEditorDecorationType({
	color: new vscode.ThemeColor("editorGhostText.foreground"),
});

let activeSuggestion: CodeSuggestion;

//TODO: This doesn't work.
const handleSelectionChange = () => {
	const activeTextEditor = vscode.window.activeTextEditor;

	if (!activeTextEditor || !activeSuggestion) {
		return;
	}

	const hasMoved =
		activeTextEditor.selection.start.character !==
		activeSuggestion.range.start.character;

	console.log(activeSuggestion.range.start, activeTextEditor.selection.start);

	if (hasMoved) {
		console.log("REMOVING");
		activeTextEditor.setDecorations(decorationType, []);

		activeTextEditor.edit((editBuilder) => {
			editBuilder.delete(activeSuggestion.range);
		});
	}
};

export class ChatViewProvider implements vscode.WebviewViewProvider {
	public static readonly viewType = "code-assistant-chat-view";

	private _disposables: vscode.Disposable[] = [];

	constructor(private readonly _extensionUri: vscode.Uri) {
		this._disposables.push(
			vscode.window.onDidChangeTextEditorSelection(handleSelectionChange)
		);
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

		webviewView.webview.onDidReceiveMessage((data) => {
			if (!data) {
				return;
			}

			switch (data.command) {
				case "hello": {
					const activeTextEditor = vscode.window.activeTextEditor;

					if (activeTextEditor) {
						const snippet = new vscode.SnippetString(
							"${1://helpful code suggestions.}"
						);

						activeTextEditor.insertSnippet(
							snippet,
							activeTextEditor.selection,
							{
								undoStopBefore: true,
								undoStopAfter: false,
							}
						);

						const start = activeTextEditor.selection.start;
						const end = activeTextEditor.selection.start.translate(
							0,
							snippet.value.length
						);
						const decoration = {
							range: new vscode.Range(start, end),
							hoverMessage: "This is a code suggestion.",
						};

						activeSuggestion = {
							range: decoration.range,
						};

						activeTextEditor.setDecorations(decorationType, [
							decoration,
						]);
					}
					break;
				}
			}
		});
	}

	private _getHtmlForWebview(webview: vscode.Webview) {
		// Get the local path to main script run in the webview, then convert it to a uri we can use in the webview.
		const scriptUri = webview.asWebviewUri(
			vscode.Uri.joinPath(
				this._extensionUri,
				"webview-ui",
				"build",
				"assets",
				"index.js"
			)
		);

		const nonce = getNonce();

		return `<!DOCTYPE html>
        <html lang="en">
          <head>
            <meta charset="UTF-8" />
            <meta name="viewport" content="width=device-width, initial-scale=1.0" />
            <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource}; script-src 'nonce-${nonce}';">
            <title>Hello World</title>
          </head>
          <body>
            <div id="root"></div>
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
