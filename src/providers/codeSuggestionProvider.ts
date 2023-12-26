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

let timeout: NodeJS.Timeout | undefined;
const newLine = new RegExp(/\r?\n/);
const startPosition = new Position(0, 0);

export class CodeSuggestionProvider implements InlineCompletionItemProvider {
	public static readonly selector: DocumentSelector = [
		{ scheme: "file", language: "typescript" },
		{ scheme: "file", language: "javascript" },
		{ scheme: "file", language: "javascriptreact" },
		{ scheme: "file", language: "typescriptreact" },
	];

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
		const [topContent, bottom, positionFromBottom] = this.getPromptContent(
			document,
			position,
			inline
		);
		if (timeout) {
			clearTimeout(timeout);
		}

		return new Promise<InlineCompletionItem[]>((res) => {
			timeout = setTimeout(() => {
				this.bouncedRequest(
					topContent,
					abort.signal,
					bottom,
					inline,
					position,
					positionFromBottom
				).then((items) => {
					res(items);
				});
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

	async bouncedRequest(
		prompt: string,
		signal: AbortSignal,
		doc: string,
		inline: boolean,
		topPos: Position,
		fromBottom: Position
	): Promise<InlineCompletionItem[]> {
		try {
			const codeResponse = await aiService.codeComplete(
				prompt,
				signal,
				[],
				doc
			);
			let cleanedCode = "";
			if (!inline) {
				cleanedCode = this.stripTopAndBottom(
					codeResponse,
					topPos,
					fromBottom
				);
			} else {
				cleanedCode = codeResponse.substring(topPos.character);
			}
			return [new InlineCompletionItem(cleanedCode)];
		} catch (error) {
			console.warn(error);
			return [];
		}
	}
}
