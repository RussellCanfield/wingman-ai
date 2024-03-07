import * as vscode from "vscode";
import { AIProvider } from "../service/base";
import { extractCodeBlock, getSymbolsFromOpenFiles } from "./utilities";

let abortController = new AbortController();

export class RefactorProvider implements vscode.CodeActionProvider {
	public static readonly command = "wingmanai.refactorcode";

	public static readonly selector: vscode.DocumentSelector = [
		{ scheme: "file", language: "typescript" },
		{ scheme: "file", language: "javascript" },
		{ scheme: "file", language: "javascriptreact" },
		{ scheme: "file", language: "typescriptreact" },
		{ scheme: "file", language: "csharp" },
		{ scheme: "file", language: "java" },
		{ scheme: "file", language: "python" },
		{ scheme: "file", language: "go" },
		{ scheme: "file", language: "php" },
		{ scheme: "file", language: "ruby" },
		{ scheme: "file", language: "rust" },
		{ scheme: "file", language: "css" },
		{ scheme: "file", language: "markdown" },
		{ scheme: "file", language: "sql" },
		{ scheme: "file", language: "less" },
		{ scheme: "file", language: "scss" },
		{ scheme: "file", language: "html" },
		{ scheme: "file", language: "json" },
	];

	public static readonly providedCodeActionKinds = [
		vscode.CodeActionKind.Refactor,
	];

	constructor(private readonly _aiProvider: AIProvider) {}

	provideCodeActions(
		document: vscode.TextDocument,
		range: vscode.Range | vscode.Selection,
		context: vscode.CodeActionContext,
		token: vscode.CancellationToken
	) {
		if (context.triggerKind !== vscode.CodeActionTriggerKind.Invoke) {
			return [];
		}

		const codeAction = new vscode.CodeAction(
			"✈️ Refactor using Wingman",
			vscode.CodeActionKind.Refactor
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
		editor: vscode.TextEditor
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

				const codeContextRange = new vscode.Range(
					range.start,
					range.end
				);
				const highlightedCode = document.getText(codeContextRange);

				const symbols = await getSymbolsFromOpenFiles();

				const result = await aiProvider.refactor(
					`Code to refactor:
\`\`\`${document.languageId}
${highlightedCode}
\`\`\``,
					symbols
						? `\nHere are local types to use as context that may aid you:\n${symbols}\n\n`
						: "",
					abortController.signal
				);

				const newCode = extractCodeBlock(result);
				editor?.edit((builder) => {
					builder.replace(codeContextRange, newCode);
				});
			}
		);
	}
}
