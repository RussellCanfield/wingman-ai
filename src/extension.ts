import * as vscode from "vscode";
import { GenDocs } from "./commands/genDocs";
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
import {
	EVENT_AI_PROVIDER_VALIDATION_FAILED,
	EVENT_EXTENSION_LOADED,
	telemetry,
} from "./providers/telemetryProvider";
import { Workspace } from "./service/workspace";
import { CodeReviewer } from "./commands/review/codeReviewer";

let statusBarProvider: ActivityStatusBar;
let diffViewProvider: DiffViewProvider;
let chatViewProvider: ChatViewProvider;
let configViewProvider: ConfigViewProvider;

export async function activate(context: vscode.ExtensionContext) {
	const settings = await LoadSettings();
	if (
		!vscode.workspace.workspaceFolders ||
		vscode.workspace.workspaceFolders.length === 0
	) {
		vscode.window.showInformationMessage(
			"Wingman requires an open workspace to function."
		);
		return;
	}

	const workspace = new Workspace(
		context,
		vscode.workspace.workspaceFolders?.[0].name,
		vscode.workspace.workspaceFolders?.[0].uri.fsPath
	);

	await lspClient.activate(context, settings, workspace);

	try {
		telemetry.sendEvent(EVENT_EXTENSION_LOADED, {
			aiProvider: settings.aiProvider,
			embeddingProvider: settings.embeddingProvider,
			chatModel:
				settings.providerSettings[settings.aiProvider]?.chatModel,
			codeModel:
				settings.providerSettings[settings.aiProvider]?.codeModel,
		});
	} catch {}

	diffViewProvider = new DiffViewProvider(context);

	let modelProvider;
	try {
		modelProvider = CreateAIProvider(settings, loggingProvider);

		if (!(await modelProvider.validateSettings())) {
			telemetry.sendEvent(EVENT_AI_PROVIDER_VALIDATION_FAILED, {
				aiProvider: settings.aiProvider,
			});
			throw new Error(
				`AI Provider ${settings.aiProvider} is not configured correctly.`
			);
		}
	} catch (error) {
		if (error instanceof Error) {
			telemetry.sendEvent(EVENT_AI_PROVIDER_VALIDATION_FAILED, {
				reason: error.message,
			});
			const result = await vscode.window.showErrorMessage(
				error.message,
				"Open Settings"
			);

			if (result === "Open Settings") {
				vscode.commands.executeCommand(
					ConfigViewProvider.showConfigCommand
				);
			}
			loggingProvider.logInfo(error.message);
			eventEmitter._onFatalError.fire();
		}
	}

	statusBarProvider = new ActivityStatusBar();

	configViewProvider = new ConfigViewProvider(context.extensionUri, settings);
	context.subscriptions.push(
		vscode.window.registerWebviewViewProvider(
			ConfigViewProvider.viewType,
			configViewProvider
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
		diffViewProvider,
		workspace,
		settings
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
				new CodeSuggestionProvider(modelProvider!, settings)
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
		settings
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
					`${ChatViewProvider.viewType}.focus`
				);
			}
		)
	);

	context.subscriptions.push(
		vscode.commands.registerCommand(
			ConfigViewProvider.showConfigCommand,
			async () => {
				configViewProvider.openInPanel();
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
	telemetry.dispose();
}
