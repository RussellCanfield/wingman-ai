import * as vscode from "vscode";
import { GenDocs } from "./commands/genDocs";
import { ChatViewProvider } from "./providers/chatViewProvider";
import { CodeSuggestionProvider } from "./providers/codeSuggestionProvider";
import { ConfigViewProvider } from "./providers/configViewProvider";
import { HotKeyCodeSuggestionProvider } from "./providers/hotkeyCodeSuggestionProvider";
import { RefactorProvider } from "./providers/refactorProvider";
import { ActivityStatusBar } from "./providers/statusBarProvider";
import lspClient from "./client/index";
import { loggingProvider } from "./providers/loggingProvider";
import { eventEmitter } from "./events/eventEmitter";
import { wingmanSettings } from "./service/settings";
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
import { ensureChromium } from "./utils/chromium";
import { OpenAI } from "@langchain/openai";

let statusBarProvider: ActivityStatusBar;
let diffViewProvider: DiffViewProvider;
let chatViewProvider: ChatViewProvider;
let configViewProvider: ConfigViewProvider;
let threadViewProvider: ThreadViewProvider;
let codeSuggestionDispoable: vscode.Disposable;

export async function activate(context: vscode.ExtensionContext) {
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
		let progressResolveOuter: (() => void) | undefined;
		let progressResolveInner: (() => void) | undefined;
		let progressObject:
			| vscode.Progress<{ message?: string; increment?: number }>
			| undefined;
		const PROGRESS_DELAY = 3000;
		let progressShown = false;

		// Create a delayed progress window
		const progressPromise = new Promise<void>((resolve) => {
			const timeout = setTimeout(() => {
				progressShown = true;
				vscode.window.withProgress(
					{
						location: vscode.ProgressLocation.Notification,
						title: "Initializing Wingman",
						cancellable: false,
					},
					async (progress) => {
						progressObject = progress;
						progress.report({
							message: "Verifying dependencies...",
						});
						return new Promise<void>((res) => {
							progressResolveInner = res;
						});
					},
				);
			}, PROGRESS_DELAY);

			// Store the resolve function to be called later
			progressResolveOuter = () => {
				clearTimeout(timeout);
				resolve();
			};
		});

		// This is required to download WASM bindings
		const bindingDownloader = new BindingDownloader(context, loggingProvider);
		await bindingDownloader.ensureBindings();

		// Update progress message for Chromium check/download
		if (progressObject) {
			progressObject.report({ message: "Setting up Chromium dependencies..." });
		}

		// Now check/download Chromium
		await ensureChromium(context?.globalStorageUri?.fsPath);

		// Resolve both promises if needed
		if (progressShown && progressResolveInner) {
			progressResolveInner();
		}
		if (progressResolveOuter) {
			progressResolveOuter();
		}

		// Wait for any pending progress to close
		await progressPromise;
	} catch (error) {
		loggingProvider.logError(error, true);
		throw error;
	}

	const workspace = new Workspace(
		context,
		vscode.workspace.workspaceFolders?.[0].name,
		vscode.workspace.workspaceFolders?.[0].uri.fsPath,
	);

	configViewProvider = new ConfigViewProvider(
		context.extensionUri,
		workspace.workspaceFolder,
		lspClient,
		context,
	);

	context.subscriptions.push(
		vscode.window.registerWebviewViewProvider(
			ConfigViewProvider.viewType,
			configViewProvider,
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

	const settings = await wingmanSettings.loadSettings();

	if (wingmanSettings.isDefault) {
		const result = await vscode.window.showErrorMessage(
			"Wingman has not yet been configured.",
			"Open Settings",
		);

		if (result === "Open Settings") {
			await vscode.commands.executeCommand(
				ConfigViewProvider.showConfigCommand,
			);
		}
	}

	try {
		telemetry.sendEvent(EVENT_EXTENSION_LOADED, {
			aiProvider: settings.aiProvider,
			chatModel: settings.providerSettings[settings.aiProvider]?.chatModel,
			codeModel: settings.providerSettings[settings.aiProvider]?.codeModel,
		});
	} catch {}

	let modelProvider: AIProvider;
	try {
		if (
			!(await lspClient.validate(vscode.workspace.workspaceFolders?.[0].name))
		) {
			telemetry.sendEvent(EVENT_AI_PROVIDER_VALIDATION_FAILED, {
				aiProvider: settings.aiProvider,
			});
			throw new Error(
				`AI Provider: ${settings.aiProvider} is not configured correctly. If you're using Ollama, try changing the model and saving your settings.`,
			);
		}
		await lspClient.activate(context, settings);
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
				await vscode.commands.executeCommand(
					ConfigViewProvider.showConfigCommand,
				);
			}
			loggingProvider.logInfo(error.message);
			eventEmitter._onFatalError.fire();
		}
	}

	diffViewProvider = new DiffViewProvider(context, lspClient);
	threadViewProvider = new ThreadViewProvider(context, lspClient);
	statusBarProvider = new ActivityStatusBar();

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
		codeSuggestionDispoable =
			vscode.languages.registerInlineCompletionItemProvider(
				CodeSuggestionProvider.selector,
				new CodeSuggestionProvider(),
			);
		context.subscriptions.push(codeSuggestionDispoable);
	}
	wingmanSettings.registerOnChangeHandler((settings) => {
		if (chatViewProvider) {
			chatViewProvider.updateSettingsOnUI();
		}

		if (settings.interactionSettings!.codeCompletionEnabled) {
			codeSuggestionDispoable =
				vscode.languages.registerInlineCompletionItemProvider(
					CodeSuggestionProvider.selector,
					new CodeSuggestionProvider(),
				);
			context.subscriptions.push(codeSuggestionDispoable);
		} else {
			const index = context.subscriptions.findIndex(
				(subscription) => subscription === codeSuggestionDispoable,
			);

			if (index !== -1) {
				context.subscriptions.splice(index, 1)[0].dispose();
			}
		}
	});

	context.subscriptions.push(
		vscode.languages.registerCodeActionsProvider(
			RefactorProvider.selector,
			new RefactorProvider(),
			{
				providedCodeActionKinds: RefactorProvider.providedCodeActionKinds,
			},
		),
	);

	await workspace.load();

	HotKeyCodeSuggestionProvider.provider = new HotKeyCodeSuggestionProvider();
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
