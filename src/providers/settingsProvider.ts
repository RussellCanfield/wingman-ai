import * as vscode from "vscode";
import { Settings } from "../types/Settings";

class SettingsProvider {
	public static Settings: Settings;

	public static async Load(context: vscode.ExtensionContext) {
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
			SettingsProvider.Settings = settings;
		} catch (error) {
			console.error("Unable to find settings file: ", error);
		}
	}
}

export default SettingsProvider;
