import * as vscode from "vscode";

export class QuickFixProvider implements vscode.CodeActionProvider {
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
			"My Quick Fix",
			vscode.CodeActionKind.QuickFix
		);
		quickFix.edit = new vscode.WorkspaceEdit();
		// Add edits to quickFix.edit here
		return [quickFix];
	}
}
