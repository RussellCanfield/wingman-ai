import * as vscode from "vscode";
import fs from "node:fs";
import type { AppMessage } from "@shared/types/Message";
import type { MCPTool, Settings } from "@shared/types/Settings";
import { addNoneAttributeToLink } from "./utilities";
import { wingmanSettings } from "../service/settings";
import type { LSPClient } from "../client";
import { MCPAdapter } from "../composer/tools/mcpAdapter";
import path from "node:path";
import { loggingProvider } from "./loggingProvider";

let panel: vscode.WebviewPanel | undefined;

export class ConfigViewProvider implements vscode.WebviewViewProvider {
	public static readonly viewType = "wingman.configview";
	public static readonly showConfigCommand = "wingmanai.openconfig";

	private _mcpAdapter: MCPAdapter;
	private _view?: vscode.WebviewView;
	private _disposables: vscode.Disposable[] = [];

	constructor(
		private readonly _extensionUri: vscode.Uri,
		private readonly workspace: string,
		private readonly _lspClient: LSPClient,
		private readonly context: vscode.ExtensionContext,
	) {
		this._mcpAdapter = new MCPAdapter(
			vscode.workspace.workspaceFolders
				? vscode.workspace.workspaceFolders[0].uri.fsPath
				: this.workspace,
		);
	}

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
			if (this._mcpAdapter) {
				this._mcpAdapter.close();
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
					let indexedFiles: string[] = [];

					try {
						indexedFiles = await this._lspClient.getIndexedFiles();
					} catch (e) {
						console.error(e);
					}

					const mcpTools = await this.getToolsFromAdapter();
					settingsPanel.webview.postMessage({
						command,
						value: {
							settings: JSON.parse(settings),
							theme: vscode.window.activeColorTheme.kind,
							indexedFiles,
							tools: Array.from(mcpTools.entries()),
						},
					});
					break;
				}
				case "resync": {
					try {
						await this._lspClient.resyncIndex();
					} catch (e) {
						console.error(e);
					}
					settingsPanel.webview.postMessage({
						command: "files",
						value: await this._lspClient.getIndexedFiles(),
					});
					break;
				}
				case "fetch-mcp": {
					const mcpTools = await this.getToolsFromAdapter();
					settingsPanel.webview.postMessage({
						command: "tools",
						value: Array.from(mcpTools),
					});
					break;
				}
				case "saveSettings":
					await wingmanSettings.saveSettings(value as Settings);
					try {
						const result = await this._lspClient.validate();

						if (!result) {
							throw new Error(
								"Failed to validate settings for your AI Provider(s). Please confirm your settings are correct",
							);
						}
						if (!this._lspClient.isRunning()) {
							await this._lspClient.activate(
								this.context,
								await wingmanSettings.loadSettings(),
							);
						}

						await this._lspClient.updateSettings();
					} catch (e) {
						if (e instanceof Error) {
							loggingProvider.logError(e);
							await settingsPanel.webview.postMessage({
								command: "save-failed",
							});
							const result = await vscode.window.showErrorMessage(
								e.message,
								"Open Settings",
							);

							if (result === "Open Settings") {
								await vscode.commands.executeCommand(
									ConfigViewProvider.showConfigCommand,
								);
							}
							break;
						}
					}
					settingsPanel.webview.postMessage({
						command: "settingsSaved",
					});
					break;
				case "load-ollama-models": {
					settingsPanel.webview.postMessage({
						command: "ollama-models",
						value: await this.loadOllamaModels(String(value)),
					});
					break;
				}
				case "load-lmstudio-models": {
					const initSettings = await wingmanSettings.loadSettings();

					settingsPanel.webview.postMessage({
						command: "lmstudio-models",
						value: await this.loadLMStudioModels(
							new URL(
								initSettings.providerSettings.LMStudio?.modelInfoPath ?? "",
								String(value),
							),
						),
					});
					break;
				}
			}
		});
	}

	async getToolsFromAdapter() {
		const mcpTools: Map<string, MCPTool[]> = new Map();
		try {
			await this._mcpAdapter.initialize();
			const results = await this._mcpAdapter.getTools();

			if (results) {
				for (const [server, tool] of Object.entries(results)) {
					const mcpTool = {
						name: tool.name,
					};
					if (mcpTools.has(server)) {
						mcpTools.get(server)?.push(mcpTool);
					} else {
						mcpTools.set(server, [mcpTool]);
					}
				}
			}
		} catch (e) {
			console.error(e);
		}

		return mcpTools;
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
		const initSettings = await wingmanSettings.loadSettings();
		const settings = structuredClone(initSettings);
		//@ts-expect-error
		settings.ollamaModels = await this.loadOllamaModels(
			settings.providerSettings.Ollama?.baseUrl ?? "",
		);
		return JSON.stringify(settings);
	};

	private loadOllamaModels = async (url: string): Promise<string[]> => {
		if (!url) {
			return ["Failed to load."];
		}

		try {
			const modelsResponse = await fetch(new URL("/api/tags", url));

			const modelsJson = (await modelsResponse.json()) as {
				models: { name: string }[];
			};
			return modelsJson.models.map((m) => m.name);
		} catch (e) {
			console.error(e);
			loggingProvider.logError(e);
			return ["Failed to load."];
		}
	};

	private loadLMStudioModels = async (url: URL): Promise<string[]> => {
		if (!url) {
			return ["Failed to load."];
		}

		try {
			const modelsResponse = await fetch(url);
			const modelsJson = (await modelsResponse.json()) as {
				data: { id: string }[];
			};
			return modelsJson.data.map((m) => m.id);
		} catch (e) {
			console.error(e);
			loggingProvider.logError(e);
			return ["Failed to load."];
		}
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
