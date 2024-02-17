import * as vscode from "vscode";
import { ChatViewProvider } from "./providers/chatViewProvider.js";
import { CodeSuggestionProvider } from "./providers/codeSuggestionProvider.js";
import { ConfigViewProvider } from "./providers/configViewProvider.js";
import {
	GetAllSettings,
	GetInteractionSettings,
	GetProviderFromSettings,
} from "./service/base.js";
import { ActivityStatusBar } from "./providers/statusBarProvider.js";
import { QuickFixProvider } from "./providers/quickFixProvider.js";
import { RefactorProvider } from "./providers/refactorProvider.js";

let statusBarProvider: ActivityStatusBar;

export async function activate(context: vscode.ExtensionContext) {
	const aiProvider = GetProviderFromSettings();
	const interactionSettings = GetInteractionSettings();

	statusBarProvider = new ActivityStatusBar();

	const settings = GetAllSettings();

	context.subscriptions.push(
		vscode.workspace.onDidChangeConfiguration((e) => {
			if (e.affectsConfiguration("Wingman")) {
				vscode.commands.executeCommand("workbench.action.reloadWindow");
			}
		})
	);

	context.subscriptions.push(
		vscode.window.registerWebviewViewProvider(
			ConfigViewProvider.viewType,
			new ConfigViewProvider(context.extensionUri, settings)
		)
	);

	context.subscriptions.push(
		vscode.window.registerWebviewViewProvider(
			ChatViewProvider.viewType,
			new ChatViewProvider(aiProvider, context, interactionSettings),
			{
				webviewOptions: {
					retainContextWhenHidden: true,
				},
			}
		)
	);

	context.subscriptions.push(
		vscode.languages.registerInlineCompletionItemProvider(
			CodeSuggestionProvider.selector,
			new CodeSuggestionProvider(aiProvider, interactionSettings)
		)
	);

	// context.subscriptions.push(
	// 	vscode.languages.registerCodeActionsProvider(
	// 		"typescript",
	// 		new QuickFixProvider(),
	// 		{
	// 			providedCodeActionKinds:
	// 				QuickFixProvider.providedCodeActionKinds,
	// 		}
	// 	)
	// );

	context.subscriptions.push(
		vscode.languages.registerCodeActionsProvider(
			RefactorProvider.selector,
			new RefactorProvider(aiProvider),
			{
				providedCodeActionKinds:
					RefactorProvider.providedCodeActionKinds,
			}
		)
	);
}

export function deactivate() {
	if (statusBarProvider) {
		statusBarProvider.dispose();
	}
}
