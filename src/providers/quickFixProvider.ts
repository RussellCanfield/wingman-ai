import * as vscode from "vscode";
import { supportedLanguages } from "./utilities";

export class QuickFixProvider implements vscode.CodeActionProvider {
	public static readonly selector = supportedLanguages;

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

		return [quickFix];
	}
}
