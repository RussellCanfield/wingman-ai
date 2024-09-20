import * as vscode from "vscode";
import fs from "node:fs";
import { AppMessage } from "@shared/types/Message";
import {
	ApiSettingsType,
	InteractionSettings,
	OllamaSettingsType,
	Settings,
} from "@shared/types/Settings";
import { loggingProvider } from "./loggingProvider";
import { eventEmitter } from "../events/eventEmitter";
import { GetInteractionSettings } from "../service/settings";
import { addNoneAttributeToLink } from "./utilities";

export class ConfigViewProvider implements vscode.WebviewViewProvider {
	public static readonly viewType = "wingman.configview";
	private _view?: vscode.WebviewView;
	private _disposables: vscode.Disposable[] = [];

	constructor(
		private readonly _extensionUri: vscode.Uri,
		private readonly _config: vscode.WorkspaceConfiguration
	) {}
	resolveWebviewView(
		webviewView: vscode.WebviewView,
		context: vscode.WebviewViewResolveContext<unknown>,
		token: vscode.CancellationToken
	): void | Thenable<void> {
		this._view = webviewView;
		webviewView.webview.options = {
			enableScripts: true,
			localResourceRoots: [this._extensionUri],
		};
		webviewView.webview.html = this._getHtml(webviewView.webview);

		this._disposables.push(
			webviewView.webview.onDidReceiveMessage((data: AppMessage) => {
				if (!data) {
					return;
				}

				const { command, value } = data;
				//@ts-ignore
				const response = this[command as keyof ConfigViewProvider](
					value
				) as string | Promise<string>;
				if (response instanceof Promise) {
					response.then((s) => {
						webviewView.webview.postMessage({
							command,
							value: s,
						});
					});
				} else if (response) {
					webviewView.webview.postMessage({
						command,
						value: response,
					});
				}
			})
		);
	}

	private init = async (value: unknown): Promise<string> => {
		const settings = {
			aiProvider:
				this._config.get<Settings["aiProvider"]>("Provider") ??
				"Ollama",
			interactionSettings: GetInteractionSettings(),
			embeddingProvider:
				this._config.get<Settings["embeddingProvider"]>(
					"EmbeddingProvider"
				) ?? "Ollama",
			ollamaEmeddingSettings: this._config.get<
				Settings["ollamaEmeddingSettings"]
			>("OllamaEmbeddingSettings"),
			openaiEmbeddingSettings: this._config.get<
				Settings["openaiEmbeddingSettings"]
			>("OpenAIEmbeddingSettings"),
			ollama: this._config.get<Settings["ollama"]>("Ollama"),
			huggingface:
				this._config.get<Settings["huggingface"]>("HuggingFace"),
			openai: this._config.get<Settings["openai"]>("OpenAI"),
			anthropic: this._config.get<Settings["anthropic"]>("Anthropic"),
		} satisfies Settings;

		//if (settings.ollama && settings.aiProvider === "Ollama") {
		try {
			const modelsResponse = await fetch(
				`${settings.ollama?.baseUrl}/api/tags`
			);
			const modelsJson = (await modelsResponse.json()) as {
				models: { name: string }[];
			};
			const modelNames = modelsJson.models.map((m) => m.name);
			//@ts-ignore
			settings["ollamaModels"] = modelNames;
		} catch (e) {
			//@ts-expect-error
			settings["ollamaModels"] = ["Failed to load."];
		}
		// } else {
		// 	//@ts-expect-error
		// 	settings["ollamaModels"] = [];
		// }
		return JSON.stringify(settings);
	};

	private handleError(message: string) {
		vscode.window.showErrorMessage(message);
		loggingProvider.logError(message);
		eventEmitter._onFatalError.fire();
	}

	private log = (value: unknown) => {
		loggingProvider.logInfo(JSON.stringify(value ?? ""));
	};

	private updateAndSetOllama = (value: OllamaSettingsType) => {
		const currentProvider =
			this._config.get<Settings["aiProvider"]>("Provider");
		if (currentProvider !== "Ollama") {
			this._config.update("Provider", "Ollama");
		}
		this._config.update("Ollama", value);
	};

	private updateAndSetOllamaEmbeddings = (value: OllamaSettingsType) => {
		const currentProvider =
			this._config.get<Settings["embeddingProvider"]>(
				"EmbeddingProvider"
			);
		if (currentProvider !== "Ollama") {
			this._config.update("EmbeddingProvider", "Ollama");
		}
		this._config.update("OllamaEmbeddingSettings", value);
	};

	private updateAndSetHF = (value: ApiSettingsType) => {
		const currentProvider =
			this._config.get<Settings["aiProvider"]>("Provider");
		if (currentProvider !== "HuggingFace") {
			this._config.update("Provider", "HuggingFace");
		}
		this._config.update("HuggingFace", value);
	};

	private updateAndSetOpenAI = (value: ApiSettingsType) => {
		const currentProvider =
			this._config.get<Settings["aiProvider"]>("Provider");
		if (currentProvider !== "OpenAI") {
			this._config.update("Provider", "OpenAI");
		}
		this._config.update("OpenAI", value);
	};

	private updateAndSetOpenAIEmbeddings = (value: ApiSettingsType) => {
		const currentProvider =
			this._config.get<Settings["embeddingProvider"]>(
				"EmbeddingProvider"
			);
		if (currentProvider !== "OpenAI") {
			this._config.update("EmbeddingProvider", "OpenAI");
		}
		this._config.update("OpenAIEmbeddingSettings", value);
	};

	private updateAndSetAnthropic = (value: ApiSettingsType) => {
		const currentProvider =
			this._config.get<Settings["aiProvider"]>("Provider");
		if (currentProvider !== "Anthropic") {
			this._config.update("Provider", "Anthropic");
		}
		this._config.update("Anthropic", value);
	};

	private changeInteractions = (value: unknown) => {
		const updated = {
			...GetInteractionSettings(),
			...(value as InteractionSettings),
		};
		this._config.update("InteractionSettings", updated);
	};

	private _getHtml = (webview: vscode.Webview) => {
		const htmlUri = webview.asWebviewUri(
			vscode.Uri.joinPath(
				this._extensionUri,
				"out",
				"views",
				"config.html"
			)
		);

		const nonce = this.getNonce();

		const htmlContent = fs.readFileSync(htmlUri.fsPath, "utf8");

		// Replace placeholders in the HTML content
		const finalHtmlContent = htmlContent.replace(
			/CSP_NONCE_PLACEHOLDER/g,
			nonce
		);

		const prefix = webview.asWebviewUri(
			vscode.Uri.joinPath(this._extensionUri, "out", "views")
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

		return addNoneAttributeToLink(updatedHtmlContent, nonce);
	};

	private getNonce = () => {
		let text = "";
		const possible =
			"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
		for (let i = 0; i < 32; i++) {
			text += possible.charAt(
				Math.floor(Math.random() * possible.length)
			);
		}
		return text;
	};

	dispose() {
		this._disposables.forEach((d) => d.dispose());
		this._disposables = [];
	}
}
