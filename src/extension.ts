import * as vscode from "vscode";
import { GenDocs } from "./commands/GenDocs";
import { ChatViewProvider } from "./providers/chatViewProvider";
import { CodeSuggestionProvider } from "./providers/codeSuggestionProvider";
import { ConfigViewProvider } from "./providers/configViewProvider";
import { HotKeyCodeSuggestionProvider } from "./providers/hotkeyCodeSuggestionProvider";
import { RefactorProvider } from "./providers/refactorProvider";
import { ActivityStatusBar } from "./providers/statusBarProvider";
import lspClient from "./client/index";
import { CreateAIProvider } from "./service/utils/models";
import { loggingProvider } from "./providers/loggingProvider";
import { eventEmitter } from "./events/eventEmitter";
import { LoadSettings } from "./service/settings";
import { DiffViewProvider } from "./providers/diffViewProvider";
import {
	startClipboardTracking,
	stopClipboardTracking,
} from "./providers/clipboardTracker";

let statusBarProvider: ActivityStatusBar;
let diffViewProvider: DiffViewProvider;
let chatViewProvider: ChatViewProvider;

export async function activate(context: vscode.ExtensionContext) {
	const settings = await LoadSettings();
	if (
		!vscode.workspace.workspaceFolders ||
		vscode.workspace.workspaceFolders.length === 0
	) {
		vscode.window.showErrorMessage(
			"Wingman requires an open workspace to function."
		);
		return;
	}

	await lspClient.activate(context, settings);

	diffViewProvider = new DiffViewProvider(context);

	let modelProvider;
	try {
		modelProvider = CreateAIProvider(settings, loggingProvider);

		if (!(await modelProvider.validateSettings())) {
			throw new Error(
				`AI Provider ${settings.aiProvider} is not configured correctly.`
			);
		}
	} catch (error) {
		if (error instanceof Error) {
			vscode.window.showErrorMessage(error.message);
			loggingProvider.logInfo(error.message);
			eventEmitter._onFatalError.fire();
		}
	}

	statusBarProvider = new ActivityStatusBar();

	context.subscriptions.push(
		vscode.window.registerWebviewViewProvider(
			ConfigViewProvider.viewType,
			new ConfigViewProvider(context.extensionUri, settings)
		)
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

	chatViewProvider = new ChatViewProvider(
		lspClient,
		modelProvider!,
		context,
		settings?.interactionSettings,
		diffViewProvider
	);
	context.subscriptions.push(
		vscode.window.registerWebviewViewProvider(
			ChatViewProvider.viewType,
			chatViewProvider,
			{
				webviewOptions: {
					retainContextWhenHidden: true,
				},
			}
		)
	);

	if (settings.interactionSettings!.codeCompletionEnabled) {
		context.subscriptions.push(
			vscode.languages.registerInlineCompletionItemProvider(
				CodeSuggestionProvider.selector,
				new CodeSuggestionProvider(
					modelProvider!,
					settings.interactionSettings!
				)
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
		settings.interactionSettings
	);
	context.subscriptions.push(
		vscode.commands.registerCommand(
			HotKeyCodeSuggestionProvider.command,
			HotKeyCodeSuggestionProvider.showSuggestion
		)
	);

	context.subscriptions.push(
		vscode.commands.registerCommand(
			ChatViewProvider.showComposerCommand,
			async () => {
				chatViewProvider.setLaunchView("composer");
				await vscode.commands.executeCommand(
					`${ChatViewProvider.viewType}.focus`,
					{
						test: true,
					}
				);
			}
		)
	);

	startClipboardTracking();
}

export function deactivate() {
	if (statusBarProvider) {
		statusBarProvider.dispose();
	}

	lspClient?.deactivate();
	diffViewProvider?.dispose();
	stopClipboardTracking();
	loggingProvider.dispose();
}
