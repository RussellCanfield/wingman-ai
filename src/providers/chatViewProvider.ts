import * as vscode from "vscode";

export class ChatViewProvider implements vscode.WebviewViewProvider {
	public static readonly viewType = "calicoColors.colorsView";

	private _view?: vscode.WebviewView;

	constructor(private readonly _extensionUri: vscode.Uri) {}

	public resolveWebviewView(
		webviewView: vscode.WebviewView,
		context: vscode.WebviewViewResolveContext,
		_token: vscode.CancellationToken
	) {
		this._view = webviewView;

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
						const fontColor = new vscode.ThemeColor(
							"editorGhostText.foreground"
						);

						const decorationType =
							vscode.window.createTextEditorDecorationType({
								color: fontColor,
							});

						const snippet = new vscode.SnippetString(
							"${1:another} ${2:placeholder}"
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
							hoverMessage: "This is a decoration",
						};

						activeTextEditor.setDecorations(decorationType, [
							decoration,
						]);

						//This obviously won't work long term.
						//Manage subscription to the event.
						//Put suggestion into state so this event can act on it.
						setTimeout(() => {
							vscode.window.onDidChangeTextEditorSelection(
								(_) => {
									console.log("REMOVING");
									activeTextEditor.setDecorations(
										decorationType,
										[]
									);

									activeTextEditor.edit((editBuilder) => {
										editBuilder.delete(decoration.range);
									});
								}
							);
						}, 10);
					}
					break;
				}
			}
		});
	}

	public addColor() {
		if (this._view) {
			this._view.show?.(true); // `show` is not implemented in 1.49 but is for 1.50 insiders
			this._view.webview.postMessage({ type: "addColor" });
		}
	}

	public clearColors() {
		if (this._view) {
			this._view.webview.postMessage({ type: "clearColors" });
		}
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
