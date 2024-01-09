import * as vscode from "vscode";
import { ChatViewProvider } from "./providers/chatViewProvider.js";
import { CodeSuggestionProvider } from "./providers/codeSuggestionProvider.js";
import { ModelProvider } from "./service/models/modelProvider.js";
import { aiService } from "./service/ai.service.js";
import SettingsProvider from "./providers/settingsProvider.js";

export async function activate(context: vscode.ExtensionContext) {
	const codeModel = ModelProvider.createCodeModelFromSettings();

	const codeModelValid = await aiService.validateModelExists(
		SettingsProvider.CodeModelName
	);

	if (!codeModelValid) {
		throw new Error(
			`Code model: ${SettingsProvider.CodeModelName} not available for use.`
		);
	}

	const chatModel = ModelProvider.createChatModelFromSettings();

	const chatModelValid = await aiService.validateModelExists(
		SettingsProvider.ChatModelName
	);

	if (!chatModelValid) {
		throw new Error(
			`Chat model: ${SettingsProvider.ChatModelName} not available for use.`
		);
	}

	context.subscriptions.push(
		vscode.window.registerWebviewViewProvider(
			ChatViewProvider.viewType,
			new ChatViewProvider(chatModel, context)
		)
	);

	context.subscriptions.push(
		vscode.languages.registerInlineCompletionItemProvider(
			CodeSuggestionProvider.selector,
			new CodeSuggestionProvider(codeModel)
		)
	);
}

export function deactivate() {}
