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
	EVENT_AI_PROVIDER_VALIDATION_FAILED,
	EVENT_EXTENSION_LOADED,
	telemetry,
} from "./providers/telemetryProvider";
import { Workspace } from "./service/workspace";
import { BindingDownloader } from "./client/bindingDownload";
import { ThreadViewProvider } from "./providers/threadViewProvider";
import type { AIProvider } from "./service/base";
import { getRecentFileTracker } from "./providers/recentFileTracker";
import { monitorFileSaves } from "./utils/files";

let statusBarProvider: ActivityStatusBar;
let diffViewProvider: DiffViewProvider;
let chatViewProvider: ChatViewProvider;
let configViewProvider: ConfigViewProvider;
let threadViewProvider: ThreadViewProvider;

export async function activate(context: vscode.ExtensionContext) {
	const settings = await LoadSettings();
	if (
		!vscode.workspace.workspaceFolders ||
		vscode.workspace.workspaceFolders.length === 0
	) {
		vscode.window.showInformationMessage(
			"Wingman requires an open workspace to function.",
		);
		return;
	}

	try {
		let progressResolve: (() => void) | undefined;
		const PROGRESS_DELAY = 3000;

		// Create a delayed progress window
		const progressPromise = new Promise<void>((resolve) => {
			const timeout = setTimeout(() => {
				vscode.window.withProgress(
					{
						location: vscode.ProgressLocation.Notification,
						title: "Initializing Wingman",
						cancellable: false,
					},
					async (progress) => {
						progress.report({ message: "Checking AST-grep bindings..." });
						return new Promise<void>((res) => {
							progressResolve = res;
						});
					},
				);
			}, PROGRESS_DELAY);

			// Store the resolve function to be called later
			progressResolve = () => {
				clearTimeout(timeout);
				resolve();
			};
		});

		// This is required to download WASM bindings for AST-grep
		const bindingDownloader = new BindingDownloader(context, loggingProvider);
		await bindingDownloader.ensureBindings();

		// Resolve the progress window if it was shown
		if (progressResolve) {
			progressResolve();
		}

		// Wait for any pending progress to close
		await progressPromise;
	} catch (error) {
		vscode.window.showErrorMessage(
			"Failed to initialize AST-grep bindings. Some features may not work correctly.",
		);
		loggingProvider.logError(error, true);
	}

	const workspace = new Workspace(
		context,
		vscode.workspace.workspaceFolders?.[0].name,
		vscode.workspace.workspaceFolders?.[0].uri.fsPath,
	);

	await lspClient.activate(context, settings, workspace);

	try {
		telemetry.sendEvent(EVENT_EXTENSION_LOADED, {
			aiProvider: settings.aiProvider,
			chatModel: settings.providerSettings[settings.aiProvider]?.chatModel,
			codeModel: settings.providerSettings[settings.aiProvider]?.codeModel,
		});
	} catch {}

	let modelProvider: AIProvider;
	try {
		modelProvider = CreateAIProvider(settings, loggingProvider);

		if (!(await modelProvider.validateSettings())) {
			telemetry.sendEvent(EVENT_AI_PROVIDER_VALIDATION_FAILED, {
				aiProvider: settings.aiProvider,
			});
			throw new Error(
				`AI Provider ${settings.aiProvider} is not configured correctly. If you're using Ollama, try changing the model and saving your settings.`,
			);
		}
	} catch (error) {
		if (error instanceof Error) {
			telemetry.sendEvent(EVENT_AI_PROVIDER_VALIDATION_FAILED, {
				reason: error.message,
			});
			const result = await vscode.window.showErrorMessage(
				error.message,
				"Open Settings",
			);

			if (result === "Open Settings") {
				vscode.commands.executeCommand(ConfigViewProvider.showConfigCommand);
			}
			loggingProvider.logInfo(error.message);
			eventEmitter._onFatalError.fire();
		}
	}

	diffViewProvider = new DiffViewProvider(context, lspClient);
	threadViewProvider = new ThreadViewProvider(context);
	statusBarProvider = new ActivityStatusBar();
	configViewProvider = new ConfigViewProvider(
		context.extensionUri,
		settings,
		lspClient,
	);

	context.subscriptions.push(
		vscode.window.registerWebviewViewProvider(
			ConfigViewProvider.viewType,
			configViewProvider,
		),
	);

	context.subscriptions.push(
		vscode.commands.registerCommand(GenDocs.command, GenDocs.generateDocs),
	);

	context.subscriptions.push(
		vscode.commands.registerCommand(
			RefactorProvider.command,
			RefactorProvider.refactorCode,
		),
	);

	context.subscriptions.push(
		vscode.languages.registerCodeActionsProvider(
			CodeSuggestionProvider.selector,
			new GenDocs(modelProvider!),
		),
	);

	chatViewProvider = new ChatViewProvider(
		lspClient,
		context,
		diffViewProvider,
		threadViewProvider,
		workspace,
		configViewProvider,
	);
	context.subscriptions.push(
		vscode.window.registerWebviewViewProvider(
			ChatViewProvider.viewType,
			chatViewProvider,
			{
				webviewOptions: {
					retainContextWhenHidden: true,
				},
			},
		),
	);

	if (settings.interactionSettings!.codeCompletionEnabled) {
		context.subscriptions.push(
			vscode.languages.registerInlineCompletionItemProvider(
				CodeSuggestionProvider.selector,
				new CodeSuggestionProvider(modelProvider!, settings),
			),
		);
	}

	context.subscriptions.push(
		vscode.languages.registerCodeActionsProvider(
			RefactorProvider.selector,
			new RefactorProvider(modelProvider!),
			{
				providedCodeActionKinds: RefactorProvider.providedCodeActionKinds,
			},
		),
	);

	await workspace.load();
	context.subscriptions.push(
		//Update the composer's graph state, so that files reflect recent changes
		//Does not apply if the file is not accepted or rejected
		monitorFileSaves((doc) => {
			const settings = workspace.getSettings();
			if (!settings.activeThreadId) return;

			const filePath = vscode.workspace.asRelativePath(doc.uri);
			lspClient.updateComposerFile({
				files: [
					{
						path: filePath,
						code: doc.getText(),
					},
				],
				threadId: settings.activeThreadId!,
			});
		}),
	);

	HotKeyCodeSuggestionProvider.provider = new HotKeyCodeSuggestionProvider(
		modelProvider!,
		settings,
	);
	context.subscriptions.push(
		vscode.commands.registerCommand(
			HotKeyCodeSuggestionProvider.command,
			HotKeyCodeSuggestionProvider.showSuggestion,
		),
	);

	context.subscriptions.push(
		vscode.commands.registerCommand(
			ChatViewProvider.showComposerCommand,
			async () => {
				chatViewProvider.setLaunchView("composer");
				await vscode.commands.executeCommand(
					`${ChatViewProvider.viewType}.focus`,
				);
			},
		),
	);

	context.subscriptions.push(
		vscode.commands.registerCommand(
			ConfigViewProvider.showConfigCommand,
			async () => {
				configViewProvider.openInPanel();
			},
		),
	);
}

export function deactivate() {
	if (statusBarProvider) {
		statusBarProvider.dispose();
	}

	getRecentFileTracker().dispose();
	lspClient?.deactivate();
	diffViewProvider?.dispose();
	threadViewProvider?.dispose();
	loggingProvider.dispose();
	telemetry.dispose();
}
