import * as vscode from "vscode";

export class QuickFixProvider implements vscode.CodeActionProvider {
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
		vscode.CodeActionKind.QuickFix,
	];

	provideCodeActions(
		document: vscode.TextDocument,
		range: vscode.Range | vscode.Selection,
		context: vscode.CodeActionContext,
		token: vscode.CancellationToken
	): vscode.ProviderResult<(vscode.Command | vscode.CodeAction)[]> {
		const quickFix = new vscode.CodeAction(
			"✈️ Wingman - Quick Fix",
			vscode.CodeActionKind.QuickFix
		);
		quickFix.edit = new vscode.WorkspaceEdit();

		console.log(range, context);

		return [quickFix];
	}
}
