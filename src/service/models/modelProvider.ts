import * as vscode from "vscode";
import SettingsProvider from "../../providers/settingsProvider";
import { BaseModel } from "../../types/Models";
import { CodeLlama } from "../models/codellama";
import { Deepseek } from "../models/deepseek";

export class ModelProvider {
	public static createChatModelFromSettings(): BaseModel {
		const chatModel = SettingsProvider.ChatModelName;

		if (chatModel.includes("codellama")) {
			return new CodeLlama();
		} else if (chatModel.includes("deepseek")) {
			return new Deepseek();
		} else {
			vscode.window.showInformationMessage(
				"Invalid chat model name, currently chat supports CodeLlama and Deepseek instruct models."
			);
			throw new Error("Invalid chat model name");
		}
	}

	public static createCodeModelFromSettings(): BaseModel {
		const chatModel = SettingsProvider.CodeModelName;

		if (chatModel.includes("codellama")) {
			return new CodeLlama();
		} else if (chatModel.includes("deepseek")) {
			return new Deepseek();
		} else {
			vscode.window.showInformationMessage(
				"Invalid code model name, currently chat supports CodeLlama-code and Deepseek-base models."
			);
			throw new Error("Invalid code model name");
		}
	}
}
