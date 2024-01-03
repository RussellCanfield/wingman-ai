import * as vscode from "vscode";
import { Settings } from "../types/Settings";

class SettingsProviderService {
	private settings: Settings = {};

	public get ModelName() {
		return this.settings.ollama?.modelName || "";
	}

	public get BaseUrl() {
		return this.settings.ollama?.baseUrl || "";
	}

	public get ApiPath() {
		return this.settings.ollama?.apiPath || "";
	}

	constructor() {
		const config = vscode.workspace.getConfiguration("WingMan");
		const ollamaConfig = config.get<Settings["ollama"]>("Ollama");
		if (ollamaConfig) {
			this.settings.ollama = ollamaConfig;
			console.log("Ollama settings loaded: ", ollamaConfig);
		}
	}
}

const SettingsProvider = new SettingsProviderService();
export default SettingsProvider;
