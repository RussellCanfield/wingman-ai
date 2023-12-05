import {
	CancellationToken,
	CompletionItem,
	CompletionItemKind,
	CompletionItemProvider,
	DocumentFilter,
	DocumentSelector,
	InlineCompletionContext,
	InlineCompletionItem,
	InlineCompletionItemProvider,
	Position,
	TextDocument,
} from "vscode";

export class CodeSuggestionProvider implements InlineCompletionItemProvider {
	public static readonly triggerCharacters: string[] = [".", " "];
	public static readonly selector: DocumentSelector = [
		"typescript",
		"javascript",
	];

	provideInlineCompletionItems(
		document: TextDocument,
		position: Position,
		context: InlineCompletionContext
	) {
		// const linePrefix = document
		// 	.lineAt(position)
		// 	.text.substr(0, position.character);

		// if (!linePrefix.endsWith("code-assistant.")) {
		// 	return undefined;
		// }

		console.log("COMPLETION");

		return [new InlineCompletionItem("hello world")];
	}
}
