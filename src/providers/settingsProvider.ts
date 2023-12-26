import * as vscode from "vscode";
import { Settings } from "../types/Settings";

class SettingsProvider {
	private static settings: Settings;

	public static get ModelName() {
		return this.settings.modelName;
	}

	public static get BaseUrl() {
		return this.settings.baseUrl;
	}

	public static get ApiPath() {
		return this.settings.apiPath;
	}

	public static async Load() {
		if (!vscode.workspace.workspaceFolders) {
			return;
		}

		const rootDir = vscode.workspace.workspaceFolders?.[0].uri;

		if (!rootDir) {
			return;
		}

		const settingsFile = vscode.Uri.joinPath(
			rootDir,
			"code-assistant.json"
		);

		try {
			const data = await vscode.workspace.fs.readFile(settingsFile);
			const settings = JSON.parse(data.toString());
			this.settings = settings;
		} catch (error) {
			console.error("Unable to find settings file: ", error);
		}
	}
}

export default SettingsProvider;
