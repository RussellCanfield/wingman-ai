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
	{ scheme: "file", language: "vue" },
	{ scheme: "file", language: "shellscript" },
	{ scheme: "file", language: "sh" },
	{ scheme: "file", language: "bash" },
	{ scheme: "file", language: "dockerfile" },
	{ scheme: "file", language: "yaml" },
	{ scheme: "file", language: "json" },
	{ scheme: "file", language: "xml" },
	{ scheme: "file", language: "markdown" },
	{ scheme: "file", language: "powershell" },
];

export async function getSymbolsFromOpenFiles() {
	let openDocuments = vscode.workspace.textDocuments;
	const types: string[] = [];
	await Promise.all(
		openDocuments.map(async (d) => {
			const symbols = (await vscode.commands.executeCommand(
				"vscode.executeDocumentSymbolProvider",
				d.uri
			)) as vscode.DocumentSymbol[];

			if (symbols) {
				await findMethod(symbols, d, types);
			}
		})
	);
	return types.join("\n");
}

export function isArrowFunction(
	symbol: vscode.DocumentSymbol,
	document: vscode.TextDocument
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
	currentSymbol?: CustomSymbol
): Promise<void> {
	for (const symbol of symbols) {
		if (
			symbol.kind === vscode.SymbolKind.Class ||
			symbol.kind === vscode.SymbolKind.Interface
		) {
			const objName = await getHoverResultsForSymbol(symbol, document);
			currentSymbol = {
				name: symbol.name,
				value: objName,
			};
			await findMethod(symbol.children, document, types, currentSymbol);
			types.push(formatSymbolAsString(currentSymbol));
			currentSymbol = undefined;
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
	let result = extractCodeBlock(customSymbol.value) + "\n";
	for (const property of customSymbol.properties ?? []) {
		result += extractCodeBlock(property) + "\n";
	}
	return result;
}

async function getHoverResultsForSymbol(
	symbol: vscode.DocumentSymbol,
	document: vscode.TextDocument
) {
	let hover = (await vscode.commands.executeCommand(
		"vscode.executeHoverProvider",
		document.uri,
		symbol.selectionRange.start
	)) as vscode.Hover[];

	if (hover && hover.length > 0) {
		return (hover[0].contents[0] as vscode.MarkdownString).value.replace(
			"(loading...)",
			""
		);
	}

	return "";
}

export function extractCodeBlock(text: string) {
	const regex = /```.*?\n([\s\S]*?)\n```/g;
	const matches = [];
	let match;
	while ((match = regex.exec(text)) !== null) {
		matches.push(match[1]);
	}
	return matches.join("\n");
}
