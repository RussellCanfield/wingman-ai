import * as vscode from "vscode";
import {
	CancellationToken,
	DocumentSelector,
	InlineCompletionContext,
	InlineCompletionItem,
	InlineCompletionItemProvider,
	Position,
	TextDocument,
} from "vscode";
import { aiService } from '../service/ai.service';
import { BaseModel } from "../service/llm";

let timeout: NodeJS.Timeout | undefined;

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
			abort.abort();
		});
		const docContext = vscode.workspace.textDocuments.reduce((acc, d) => {
			if (d.fileName.includes(".git")) {
				return acc;
			}

			const doc = `//${d.fileName.lastIndexOf("/") > -1
				? d.fileName.substring(d.fileName.lastIndexOf("/") + 1)
				: d.fileName
				}
			${d.getText().substring(0, 512)}

			`;
			docContext;
			acc += doc;

			return acc;
		}, "");

		const prevLine = document
			.lineAt(position.line - 1)
			.text;

		if (timeout) {
			clearTimeout(timeout);
		}

		return new Promise<InlineCompletionItem[]>((res) => {
			timeout = setTimeout(() => {
				this.bouncedRequest(prevLine, abort.signal, docContext)
					.then(items => {
						res(items);
					});
			}, 300);
		});
	}

	async bouncedRequest(prompt: string, signal: AbortSignal, doc: string): Promise<InlineCompletionItem[]> {
		try {
			let response: string[] = [];
			console.log('Making request')
			for await (let chars of aiService.codeComplete(prompt, signal, [], doc)) {
				response.push(chars);
			}
			const stringResponse = response.join('');
			console.log(stringResponse);
			return [new InlineCompletionItem(stringResponse)];
		} catch (error) {
			return [];
		}
	}
}