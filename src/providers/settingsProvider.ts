import * as vscode from "vscode";
import { Settings } from "../types/Settings";

class SettingsProvider {
	private static settings: Settings;

	// public static get ModelName() {
	// 	return this.settings.modelName;
	// }

	// public static get BaseUrl() {
	// 	return this.settings.baseUrl;
	// }

	// public static get ApiPath() {
	// 	return this.settings.apiPath;
	// }

	public static async Load() {
		console.log(vscode.workspace.getConfiguration('WingMan').get('Ollama'))
	}
}

export default SettingsProvider;
