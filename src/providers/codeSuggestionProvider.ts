import * as vscode from "vscode";
import {
	CancellationToken,
	DocumentSelector,
	InlineCompletionContext,
	InlineCompletionItem,
	InlineCompletionItemProvider,
	Position,
	Range,
	TextDocument,
} from "vscode";
import { AIProvider } from "../service/base";
import { eventEmitter } from "../events/eventEmitter";

let timeout: NodeJS.Timeout | undefined;
const newLine = new RegExp(/\r?\n/);
const startPosition = new Position(0, 0);

export class CodeSuggestionProvider implements InlineCompletionItemProvider {
	public static readonly selector: DocumentSelector = [
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

	private _aiProvider: AIProvider;

	constructor(aiProvider: AIProvider) {
		this._aiProvider = aiProvider;
	}

	getSafeWindow = (lineNumber: number, windowSize: number) => {
		lineNumber - windowSize < 0 ? 0 : lineNumber - windowSize;
	};

	async provideInlineCompletionItems(
		document: TextDocument,
		position: Position,
		context: InlineCompletionContext,
		token: CancellationToken
	) {
		const abort = new AbortController();
		token.onCancellationRequested((e) => {
			console.log(e);
			abort.abort();
			eventEmitter._onQueryComplete.fire();
		});

		const prefix = this.getPreContent();
		const suffix = this.getSuffixContent();

		if (timeout) {
			clearTimeout(timeout);
		}

		return new Promise<InlineCompletionItem[]>((res) => {
			timeout = setTimeout(() => {
				this.bouncedRequest(prefix, abort.signal, suffix).then(
					(items) => {
						res(items);
					}
				);
			}, 300);
		});
	}
	private getPreContent() {
		const editor = vscode.window.activeTextEditor;
		if (!editor) {
			return "";
		}

		const lineWindow = 15;

		const { document, selection } = editor;

		const currentLine = selection.active.line;
		const beginningWindowLine = document.lineAt(
			Math.max(0, currentLine - lineWindow)
		);
		const range = new vscode.Range(
			beginningWindowLine.range.start,
			selection.end
		);
		return document.getText(range);
	}

	private getSuffixContent() {
		const editor = vscode.window.activeTextEditor;
		if (!editor) {
			return "";
		}

		const lineWindow = 15;

		const { document, selection } = editor;

		const currentLine = selection.active.line;
		const beginningWindowLine = document.lineAt(
			Math.min(document.lineCount - 1, currentLine + 1)
		);
		const endWindowLine = document.lineAt(
			Math.min(document.lineCount - 1, currentLine + lineWindow)
		);
		const range = new vscode.Range(
			beginningWindowLine.range.start,
			endWindowLine.range.end
		);
		return document.getText(range);
	}

	async bouncedRequest(
		prefix: string,
		signal: AbortSignal,
		suffix: string
	): Promise<InlineCompletionItem[]> {
		try {
			eventEmitter._onQueryStart.fire();
			const codeResponse = await this._aiProvider.codeComplete(
				prefix,
				suffix,
				signal
			);
			eventEmitter._onQueryComplete.fire();
			return [new InlineCompletionItem(codeResponse)];
		} catch (error) {
			console.warn(error);
			return [];
		}
	}
}
