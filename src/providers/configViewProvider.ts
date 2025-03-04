import * as vscode from "vscode";
import fs from "node:fs";
import type { AppMessage } from "@shared/types/Message";
import type { MCPToolConfig, Settings } from "@shared/types/Settings";
import { addNoneAttributeToLink } from "./utilities";
import { SaveSettings } from "../service/settings";
import { createMCPTool } from "../composer/v2/tools/mcpTools";
import type { LSPClient } from "../client";

let panel: vscode.WebviewPanel | undefined;

export class ConfigViewProvider implements vscode.WebviewViewProvider {
	public static readonly viewType = "wingman.configview";
	public static readonly showConfigCommand = "wingmanai.openconfig";
	private _view?: vscode.WebviewView;
	private _disposables: vscode.Disposable[] = [];

	constructor(
		private readonly _extensionUri: vscode.Uri,
		private readonly _settings: Settings,
		private readonly _lspClient: LSPClient,
	) {}

	private createPanel(): vscode.WebviewPanel {
		panel = vscode.window.createWebviewPanel(
			"wingmanConfig",
			"Wingman Configuration",
			vscode.ViewColumn.One,
			{
				enableScripts: true,
				localResourceRoots: [this._extensionUri],
			},
		);

		panel.webview.html = this._getHtml(panel.webview);
		return panel;
	}

	public openInPanel() {
		if (panel) {
			panel.reveal();
			return;
		}

		const settingsPanel = this.createPanel();
		settingsPanel.onDidDispose(() => {
			panel = undefined;
			if (this._view) {
				this._view.webview.postMessage({ command: "panelClosed" });
			}
		});

		// Handle messages from the panel
		settingsPanel.webview.onDidReceiveMessage(async (data: AppMessage) => {
			if (!data) {
				return;
			}

			const { command, value } = data;

			switch (command) {
				case "init": {
					const settings = await this.init(value);
					settingsPanel.webview.postMessage({
						command,
						value: {
							settings: JSON.parse(settings),
							theme: vscode.window.activeColorTheme.kind,
						},
					});
					break;
				}
				case "test-mcp": {
					let success = false;
					const foundTools: MCPToolConfig["tools"] = [];
					let tool: ReturnType<typeof createMCPTool> | undefined;
					try {
						tool = createMCPTool(value as MCPToolConfig);
						await tool.connect();
						const { tools } = await tool.getTools();
						success = tools.length > 0;
						if (success) {
							foundTools.push(...tools.map((t) => ({ name: t.name })));
						}
					} catch (e) {
						console.error(e);
						if (e instanceof Error) {
							vscode.window.showErrorMessage(
								`MCP Tool: ${(value as MCPToolConfig).name} failed validation: ${e.message}`,
							);
						}
					} finally {
						if (tool) {
							await tool.close();
						}
					}

					await this._lspClient.updateMCPTools();
					settingsPanel.webview.postMessage({
						command: "tool-verified",
						value: {
							...(value as MCPToolConfig),
							verified: success,
							tools: foundTools,
						} satisfies MCPToolConfig,
					});
					break;
				}
				case "saveSettings":
					SaveSettings(value as Settings);
					break;
				case "reloadWindow":
					await vscode.commands.executeCommand("workbench.action.reloadWindow");
					break;
			}
		});
	}

	resolveWebviewView(
		webviewView: vscode.WebviewView,
		context: vscode.WebviewViewResolveContext<unknown>,
		token: vscode.CancellationToken,
	): void | Thenable<void> {
		this._view = webviewView;
		webviewView.webview.options = {
			enableScripts: true,
			localResourceRoots: [this._extensionUri],
		};
		webviewView.webview.html = this._getSimpleViewHtml(webviewView.webview);

		this._disposables.push(
			webviewView.webview.onDidReceiveMessage(async (data: AppMessage) => {
				if (!data) {
					return;
				}

				const { command, value } = data;

				switch (command) {
					case "openSettings":
						this.openInPanel();
						break;
				}
			}),
		);
	}

	private init = async (value: unknown): Promise<string> => {
		const settings = structuredClone(this._settings);

		try {
			const modelsResponse = await fetch(
				`${settings.providerSettings.Ollama?.baseUrl}/api/tags`,
			);
			const modelsJson = (await modelsResponse.json()) as {
				models: { name: string }[];
			};
			const modelNames = modelsJson.models.map((m) => m.name);
			//@ts-expect-error
			settings.ollamaModels = modelNames;
		} catch (e) {
			//@ts-expect-error
			settings.ollamaModels = ["Failed to load."];
		}

		return JSON.stringify(settings);
	};

	private _getSimpleViewHtml = (webview: vscode.Webview): string => {
		const nonce = this.getNonce();

		return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource} 'unsafe-inline'; script-src 'nonce-${nonce}';">
    <title>Config View</title>
    <style nonce="${nonce}">
        button {
            padding: 8px 16px;
            background-color: var(--vscode-button-background);
            color: var(--vscode-button-foreground);
            border: none;
            cursor: pointer;
        }
        button:hover {
            background-color: var(--vscode-button-hoverBackground);
        }
    </style>
</head>
<body>
  <div>
    <h3>Wingman</h3>
    <button id="open">Open Settings</button>
  </div>
    <script nonce="${nonce}">
        const vscode = acquireVsCodeApi();
        document.getElementById('open').addEventListener('click', () => {
            vscode.postMessage({ command: 'openSettings' });
        });
    </script>
</body>
</html>`;
	};

	private _getHtml = (webview: vscode.Webview) => {
		const htmlUri = webview.asWebviewUri(
			vscode.Uri.joinPath(this._extensionUri, "out", "views", "config.html"),
		);

		const nonce = this.getNonce();

		const htmlContent = fs.readFileSync(htmlUri.fsPath, "utf8");

		// Replace placeholders in the HTML content
		const finalHtmlContent = htmlContent.replace(
			/CSP_NONCE_PLACEHOLDER/g,
			nonce,
		);

		const prefix = webview.asWebviewUri(
			vscode.Uri.joinPath(this._extensionUri, "out", "views"),
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

		return addNoneAttributeToLink(updatedHtmlContent, nonce);
	};

	private getNonce = () => {
		let text = "";
		const possible =
			"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
		for (let i = 0; i < 32; i++) {
			text += possible.charAt(Math.floor(Math.random() * possible.length));
		}
		return text;
	};

	dispose() {
		// biome-ignore lint/complexity/noForEach: <explanation>
		this._disposables.forEach((d) => d.dispose());
		this._disposables = [];
	}
}
