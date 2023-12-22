import * as vscode from "vscode";
import {
	CancellationToken,
	DocumentSelector,
	InlineCompletionContext,
	InlineCompletionItem,
	InlineCompletionItemProvider,
	Position,
	Range,
	TextDocument
} from "vscode";
import { aiService } from '../service/ai.service';
import { BaseModel } from "../service/llm";

let timeout: NodeJS.Timeout | undefined;

const startPosition = new Position(0, 0);
export class CodeSuggestionProvider implements InlineCompletionItemProvider {
	public static readonly selector: DocumentSelector = [
		{ scheme: "file", language: "typescript" },
		{ scheme: "file", language: "javascript" },
		{ scheme: 'file', language: 'javascriptreact' },
		{ scheme: 'file', language: 'typescriptreact' }
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
		token.onCancellationRequested(e => {
			console.log(e);
			abort.abort();
		});
		// const docContext = vscode.workspace.textDocuments.reduce((acc, d) => {
		// 	if (d.fileName.includes(".git")) {
		// 		return acc;
		// 	}

		// 	const doc = `//${d.fileName.lastIndexOf("/") > -1
		// 		? d.fileName.substring(d.fileName.lastIndexOf("/") + 1)
		// 		: d.fileName
		// 		}
		// 	${d.getText().substring(0, 512)}

		// 	`;
		// 	docContext;
		// 	acc += doc;

		// 	return acc;
		// }, "");

		const rg = new Range(startPosition, position);
		const topContent = document.getText(rg);
		const after = new Position(position.line + 1, 0);
		const lastPosition = document.lineAt(document.lineCount - 1).range.end;
		let bottom = '';
		if (lastPosition.line !== position.line) {
			const end = new Range(after, lastPosition);
			bottom = document.getText(end);
		}

		if (timeout) {
			clearTimeout(timeout);
		}

		return new Promise<InlineCompletionItem[]>((res) => {
			timeout = setTimeout(() => {
				this.bouncedRequest(topContent, abort.signal, bottom)
					.then(items => {
						res(items);
					});
			}, 300);
		});
	}

	async bouncedRequest(prompt: string, signal: AbortSignal, doc: string): Promise<InlineCompletionItem[]> {
		try {
			console.log('Making request');
			const codeResponse = await aiService.codeComplete(prompt, signal, [], doc);
			console.log('+++++++++++++++++++++++++++++++++++++')
			console.log('Remoing prompt ', prompt)
			console.log(codeResponse.trim().indexOf(prompt));

			let topRemoved = codeResponse.replace(prompt, '');
			console.log(topRemoved)
			let cleanedCode = topRemoved.replace(doc, '');
			return [new InlineCompletionItem(cleanedCode)];
		} catch (error) {
			console.warn(error);
			return [];
		}
	}
}