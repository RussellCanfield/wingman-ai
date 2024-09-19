/* --------------------------------------------------------------------------------------------
 * Copyright (c) Microsoft Corporation. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */
import * as vscode from "vscode";
import { GenDocs } from "./commands/GenDocs.js";
import { ChatViewProvider } from "./providers/chatViewProvider.js";
import { CodeSuggestionProvider } from "./providers/codeSuggestionProvider.js";
import { ConfigViewProvider } from "./providers/configViewProvider.js";
import { HotKeyCodeSuggestionProvider } from "./providers/hotkeyCodeSuggestionProvider.js";
import { RefactorProvider } from "./providers/refactorProvider.js";
import { ActivityStatusBar } from "./providers/statusBarProvider.js";
import lspClient from "./client/index.js";
import { CreateAIProvider } from "./service/utils/models.js";
import { loggingProvider } from "./providers/loggingProvider.js";
import { eventEmitter } from "./events/eventEmitter.js";
import { GetAllSettings, GetSettings } from "./service/settings.js";
import { DiffViewProvider } from "./providers/diffViewProvider.js";

let statusBarProvider: ActivityStatusBar;
let diffViewProvider: DiffViewProvider;

export async function activate(context: vscode.ExtensionContext) {
	const {
		aiProvider,
		embeddingProvider,
		embeddingSettings,
		config,
		interactionSettings,
	} = GetSettings();

	if (
		!vscode.workspace.workspaceFolders ||
		vscode.workspace.workspaceFolders.length === 0
	) {
		vscode.window.showErrorMessage(
			"Wingman requires an open workspace to function."
		);
		return;
	}

	await lspClient.activate(
		context,
		config,
		aiProvider,
		embeddingProvider,
		embeddingSettings,
		interactionSettings!
	);

	diffViewProvider = new DiffViewProvider(context);

	let modelProvider;
	try {
		modelProvider = CreateAIProvider(
			aiProvider,
			config,
			interactionSettings!
		);
	} catch (error) {
		if (error instanceof Error) {
			vscode.window.showErrorMessage(error.message);
			loggingProvider.logInfo(error.message);
			eventEmitter._onFatalError.fire();
		}
	}

	statusBarProvider = new ActivityStatusBar();

	const settings = GetAllSettings();

	context.subscriptions.push(
		vscode.window.registerWebviewViewProvider(
			ConfigViewProvider.viewType,
			new ConfigViewProvider(context.extensionUri, settings)
		)
	);

	context.subscriptions.push(
		vscode.workspace.onDidChangeConfiguration((e) => {
			if (e.affectsConfiguration("Wingman")) {
				vscode.commands.executeCommand("workbench.action.reloadWindow");
			}
		})
	);

	context.subscriptions.push(
		vscode.commands.registerCommand(GenDocs.command, GenDocs.generateDocs)
	);

	context.subscriptions.push(
		vscode.commands.registerCommand(
			RefactorProvider.command,
			RefactorProvider.refactorCode
		)
	);

	context.subscriptions.push(
		vscode.languages.registerCodeActionsProvider(
			CodeSuggestionProvider.selector,
			new GenDocs(modelProvider!)
		)
	);

	context.subscriptions.push(
		vscode.window.registerWebviewViewProvider(
			ChatViewProvider.viewType,
			new ChatViewProvider(
				lspClient,
				modelProvider!,
				context,
				interactionSettings!,
				diffViewProvider
			),
			{
				webviewOptions: {
					retainContextWhenHidden: true,
				},
			}
		)
	);

	if (interactionSettings!.codeCompletionEnabled) {
		context.subscriptions.push(
			vscode.languages.registerInlineCompletionItemProvider(
				CodeSuggestionProvider.selector,
				new CodeSuggestionProvider(modelProvider!, interactionSettings!)
			)
		);
	}

	context.subscriptions.push(
		vscode.languages.registerCodeActionsProvider(
			RefactorProvider.selector,
			new RefactorProvider(modelProvider!),
			{
				providedCodeActionKinds:
					RefactorProvider.providedCodeActionKinds,
			}
		)
	);

	HotKeyCodeSuggestionProvider.provider = new HotKeyCodeSuggestionProvider(
		modelProvider!,
		interactionSettings!
	);
	context.subscriptions.push(
		vscode.commands.registerCommand(
			HotKeyCodeSuggestionProvider.command,
			HotKeyCodeSuggestionProvider.showSuggestion
		)
	);
}

export function deactivate() {
	if (statusBarProvider) {
		statusBarProvider.dispose();
	}

	lspClient?.deactivate();
	diffViewProvider?.dispose();
}
