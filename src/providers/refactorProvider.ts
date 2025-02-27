import * as vscode from "vscode";
import type { AIProvider } from "../service/base";
import {
	extractCodeBlock,
	getSymbolsFromOpenFiles,
	supportedLanguages,
} from "./utilities";
import { eventEmitter } from "../events/eventEmitter";
import { EVENT_REFACTOR, telemetry } from "./telemetryProvider";

// biome-ignore lint/style/useConst: <explanation>
let abortController = new AbortController();

export class RefactorProvider implements vscode.CodeActionProvider {
	public static readonly command = "wingmanai.refactorcode";

	public static readonly selector = supportedLanguages;

	public static readonly providedCodeActionKinds = [
		vscode.CodeActionKind.Refactor,
	];

	constructor(private readonly _aiProvider: AIProvider) {}

	provideCodeActions(
		document: vscode.TextDocument,
		range: vscode.Range | vscode.Selection,
		context: vscode.CodeActionContext,
		token: vscode.CancellationToken,
	) {
		if (context.triggerKind !== vscode.CodeActionTriggerKind.Invoke) {
			return [];
		}

		const codeAction = new vscode.CodeAction(
			"✈️ Refactor using Wingman",
			vscode.CodeActionKind.Refactor,
		);
		codeAction.edit = new vscode.WorkspaceEdit();
		codeAction.command = {
			command: RefactorProvider.command,
			title: "✈️ Refactor using Wingman",
			arguments: [
				document,
				range,
				this._aiProvider,
				vscode.window.activeTextEditor,
			],
		};
		return [codeAction];
	}

	static refactorCode(
		document: vscode.TextDocument,
		range: vscode.Range | vscode.Selection,
		aiProvider: AIProvider,
		editor: vscode.TextEditor,
	) {
		return vscode.window.withProgress(
			{
				location: vscode.ProgressLocation.Window,
				title: "Refactoring...",
			},
			async (process, token) => {
				if (token.isCancellationRequested && abortController) {
					abortController.abort();
				}

				eventEmitter._onQueryStart.fire();
				const codeContextRange = new vscode.Range(range.start, range.end);
				const highlightedCode = document.getText(codeContextRange);

				const symbols = await getSymbolsFromOpenFiles();

				telemetry.sendEvent(EVENT_REFACTOR);

				const result = await aiProvider.refactor(
					`Code to refactor:
\`\`\`${document.languageId}
${highlightedCode}
\`\`\``,
					symbols
						? `\nHere are the available types to use as a reference in answering questions, these may not be related to the code provided:\n${symbols}\n----------\n`
						: "",
					abortController.signal,
				);

				const newCode = extractCodeBlock(result);

				if (newCode) {
					editor?.edit((builder) => {
						builder.replace(codeContextRange, newCode);
					});
				}
				eventEmitter._onQueryComplete.fire();
			},
		);
	}
}
