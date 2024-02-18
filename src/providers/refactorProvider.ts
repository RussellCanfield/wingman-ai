import * as vscode from "vscode";
import { AIProvider } from "../service/base";

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

				const symbols = await vscode.commands.executeCommand<
					vscode.DocumentSymbol[]
				>("vscode.executeDocumentSymbolProvider", document.uri);
				if (!symbols) {
					return;
				}

				const codeContextRange = new vscode.Range(
					range.start,
					range.end
				);
				const highlightedCode = document.getText(codeContextRange);

				const generator = aiProvider.chat(
					`Refactor the following code to be clean, concise and performant. Always favor readability.
Do not make assumptions about what modules are available, if no imports are in the code provided, do not attempt to import additional modules.
The user may be referencing libraries you are not familiar with, if the syntax seems unfamiliar do your best to preserve it.
Ensure that the code is idiomatic and follows best practices.
Code to refactor:

\`\`\`${document.languageId}
${highlightedCode}
\`\`\``,
					"",
					abortController.signal
				);

				let newCode = "";
				for await (const chunk of generator) {
					newCode += chunk;
				}

				console.log(newCode);

				newCode = extractCodeBlock(newCode);
				editor?.edit((builder) => {
					builder.replace(codeContextRange, newCode);
				});
			}
		);
	}
}

function extractCodeBlock(text: string) {
	const regex = /```.*?\n([\s\S]*?)\n```/g;
	const matches = [];
	let match;
	while ((match = regex.exec(text)) !== null) {
		matches.push(match[1]);
	}
	return matches.join("\n");
}
