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
import { aiService } from "../service/ai.service";
import { BaseModel } from "../types/Models";

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

	private _model: BaseModel;

	constructor(model: BaseModel) {
		this._model = model;
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
		});
		const inline = Boolean(document.lineAt(position).text.trim());
		// const [topContent, bottom, positionFromBottom] = this.getPromptContent(
		// 	document,
		// 	position,
		// 	inline
		// );

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

	private getPromptContent(
		document: TextDocument,
		position: Position,
		inline: boolean
	): [string, string, Position] {
		let topContent = "";
		if (!inline) {
			const rg = new Range(startPosition, position);
			topContent = document.getText(rg);
		} else {
			topContent = document.lineAt(position).text;
		}

		let bottom = "";
		let positionFromBottom = startPosition;
		if (!inline) {
			const after = new Position(position.line + 1, 0);
			const lastPosition = document.lineAt(document.lineCount - 1).range
				.end;
			if (lastPosition.line !== position.line) {
				const end = new Range(after, lastPosition);
				bottom = document.getText(end);
			}
			positionFromBottom = new Position(
				lastPosition.line - after.line,
				0
			);
		}

		return [topContent, bottom, positionFromBottom];
	}

	private stripTopAndBottom(
		code: string,
		topPos: Position,
		fromBottom: Position
	) {
		let linePost = 0;
		let lineCount = 0;
		let linesCharPos = new Map<number, number>();
		for (let i = 0; i < code.length; i++) {
			if (newLine.test(code[i])) {
				linesCharPos.set(lineCount, linePost);
				lineCount++;
				linePost = i + 1;
			}
		}
		const topCharCount = linesCharPos.get(topPos.line - 1);
		if (!topCharCount) {
			return "";
		}
		let cleanedCode = code;
		if (fromBottom.line > 0) {
			const lineToRemove = lineCount - fromBottom.line;
			const lineToRemoveChar = linesCharPos.get(lineToRemove);
			if (lineToRemoveChar) {
				cleanedCode = cleanedCode.substring(0, lineToRemoveChar);
			}
		}
		cleanedCode = cleanedCode.substring(topCharCount + topPos.character);
		return cleanedCode;
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
			const payload = this._model.getCodeCompletionPayload(
				prefix,
				suffix
			);
			const codeResponse = await aiService.codeComplete(payload, signal);

			// const codeResponse = await aiService.codeComplete(
			// 	prompt,
			// 	signal,
			// 	[],
			// 	doc
			// );
			// let cleanedCode = "";
			// if (!inline) {
			// 	cleanedCode = this.stripTopAndBottom(
			// 		codeResponse,
			// 		topPos,
			// 		fromBottom
			// 	);
			// } else {
			// 	cleanedCode = codeResponse.substring(topPos.character);
			// }
			return [new InlineCompletionItem(codeResponse)];
		} catch (error) {
			console.warn(error);
			return [];
		}
	}
}
