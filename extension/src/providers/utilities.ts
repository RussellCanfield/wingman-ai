import * as vscode from "vscode";

export const supportedLanguages: vscode.DocumentSelector = [
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
	{ scheme: "file", language: "jsonc" },
	{ scheme: "file", language: "vue" },
	{ scheme: "file", language: "vue-html" },
	{ scheme: "file", language: "shellscript" },
	{ scheme: "file", language: "sh" },
	{ scheme: "file", language: "bash" },
	{ scheme: "file", language: "dockerfile" },
	{ scheme: "file", language: "yaml" },
	{ scheme: "file", language: "json" },
	{ scheme: "file", language: "xml" },
	{ scheme: "file", language: "markdown" },
	{ scheme: "file", language: "powershell" },
	{ scheme: "file", language: "astro" },
	{ scheme: "file", language: "svelte" },
	{ scheme: "file", language: "dart" },
	{ scheme: "file", language: "kotlin" },
	{ scheme: "file", language: "swift" },
	{ scheme: "file", language: "lua" },
	{ scheme: "file", language: "graphql" },
	{ scheme: "file", language: "toml" },
	{ scheme: "file", language: "c" },
	{ scheme: "file", language: "cpp" },
	{ scheme: "file", language: "perl" },
	{ scheme: "file", language: "razor" },
	{ scheme: "file", language: "bat" },
	{ scheme: "file", language: "plaintext" },
];

export async function getSymbolsFromOpenFiles() {
	const openDocuments = vscode.workspace.textDocuments.filter(
		(d) => d.uri.scheme === "file",
	);
	const types: string[] = [];
	await Promise.all(
		openDocuments.map(async (d) => {
			const symbols = (await vscode.commands.executeCommand(
				"vscode.executeDocumentSymbolProvider",
				d.uri,
			)) as vscode.DocumentSymbol[];

			if (symbols) {
				await findMethod(symbols, d, types);
			}
		}),
	);
	return types.join("\n");
}

export function isArrowFunction(
	symbol: vscode.DocumentSymbol,
	document: vscode.TextDocument,
) {
	const isProperty =
		symbol.kind === vscode.SymbolKind.Property ||
		symbol.kind === vscode.SymbolKind.Variable;
	if (!isProperty) {
		return false;
	}

	return (
		document
			.getText(new vscode.Range(symbol.range.start, symbol.range.end))
			.includes("=>") ||
		document.lineAt(symbol.range.start.line).text.includes("=>")
	);
}

type CustomSymbol = {
	name: string;
	value: string;
	properties?: string[];
};

async function findMethod(
	symbols: vscode.DocumentSymbol[],
	document: vscode.TextDocument,
	types: string[],
	currentSymbol?: CustomSymbol,
): Promise<void> {
	for (const symbol of symbols) {
		if (
			symbol.kind === vscode.SymbolKind.Class ||
			symbol.kind === vscode.SymbolKind.Interface
		) {
			const objName = await getHoverResultsForSymbol(symbol, document);
			const customSymbol = {
				name: symbol.name,
				value: objName,
			};
			await findMethod(symbol.children, document, types, customSymbol);
			types.push(formatSymbolAsString(customSymbol));
		} else if (
			symbol.kind === vscode.SymbolKind.Method ||
			symbol.kind === vscode.SymbolKind.Function ||
			symbol.kind === vscode.SymbolKind.Property ||
			isArrowFunction(symbol, document)
		) {
			const results = await getHoverResultsForSymbol(symbol, document);
			if (results) {
				if (currentSymbol) {
					if (!currentSymbol.properties) {
						currentSymbol.properties = [];
					}
					currentSymbol.properties.push(results);
				} else {
					types.push(extractCodeBlock(results));
				}
			}
		}
	}
}

function formatSymbolAsString(customSymbol: CustomSymbol): string {
	let result = `${extractCodeBlock(customSymbol.value)}\n`;
	for (const property of customSymbol.properties ?? []) {
		result += `${extractCodeBlock(property)}\n`;
	}
	return result;
}

async function getHoverResultsForSymbol(
	symbol: vscode.DocumentSymbol,
	document: vscode.TextDocument,
) {
	const hover = (await vscode.commands.executeCommand(
		"vscode.executeHoverProvider",
		document.uri,
		symbol.selectionRange.start,
	)) as vscode.Hover[];

	if (hover && hover.length > 0) {
		return (hover[0].contents[0] as vscode.MarkdownString).value.replace(
			"(loading...)",
			"",
		);
	}

	return "";
}

export function extractCodeBlock(text: string): string {
	const regex = /```.*?\n([\s\S]*?)\n```/g;
	const matches: string[] = [];

	let match: RegExpExecArray | null;
	// biome-ignore lint/suspicious/noAssignInExpressions: <explanation>
	while ((match = regex.exec(text)) !== null) {
		matches.push(match[1]);
	}

	return matches.length > 0 ? matches.join("\n") : text;
}

export function addNoneAttributeToLink(htmlString: string, noneValue: string) {
	// Regular expression to match the link tag
	const linkRegex =
		/<link\s+(?:[^>]*?\s+)?href=["']https:\/\/file%2B\.vscode-resource\.vscode-cdn\.net\/[^"']*\.css["'][^>]*>/i;

	// Function to add the none attribute
	const addNoneAttribute = (match: string) => {
		if (match.includes("nonce=")) {
			// If none attribute already exists, return the original match
			return match;
		}
		// Add none attribute before the closing angle bracket
		return match.replace(/>$/, ` nonce="${noneValue}">`);
	};

	// Replace the matched link tag with the modified version
	return htmlString.replace(linkRegex, addNoneAttribute);
}

export function getNonce() {
	let text = "";
	const possible =
		"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
	for (let i = 0; i < 32; i++) {
		text += possible.charAt(Math.floor(Math.random() * possible.length));
	}
	return text;
}

export async function replaceTextInDocument(
	document: vscode.TextDocument,
	newContent: string,
	shouldSave = false,
) {
	// Create a range for the entire document
	const startPosition = new vscode.Position(0, 0);
	const endPosition = new vscode.Position(
		document.lineCount - 1,
		document.lineAt(document.lineCount - 1).text.length,
	);
	const range = new vscode.Range(startPosition, endPosition);

	const edit = new vscode.WorkspaceEdit();
	edit.replace(document.uri, range, newContent);
	// Apply the edit to replace the entire content
	const success = await vscode.workspace.applyEdit(edit);

	if (success && shouldSave) {
		await document.save();
	}
}

export function getActiveWorkspace() {
	const defaultWorkspace = "default";

	const activeEditor = vscode.window.activeTextEditor;
	if (activeEditor) {
		return (
			vscode.workspace.getWorkspaceFolder(activeEditor.document.uri)?.name ??
			defaultWorkspace
		);
	}

	return vscode.workspace.workspaceFolders?.[0].name ?? defaultWorkspace;
}
