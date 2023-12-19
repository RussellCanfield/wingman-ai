import {
	CancellationToken,
	DocumentSelector,
	InlineCompletionContext,
	InlineCompletionItem,
	InlineCompletionItemProvider,
	Position,
	TextDocument,
	Range,
} from "vscode";
import * as vscode from "vscode";
import { BaseModel } from "../service/llm";

let timeout: NodeJS.Timeout | undefined;

export class CodeSuggestionProvider implements InlineCompletionItemProvider {
	public static readonly selector: DocumentSelector = [
		{ scheme: "file", language: "typescript" },
		{ scheme: "file", language: "javascript" },
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
		const docContext = vscode.workspace.textDocuments.reduce((acc, d) => {
			if (d.fileName.includes(".git")) {
				return acc;
			}

			const doc = `//${
				d.fileName.lastIndexOf("/") > -1
					? d.fileName.substring(d.fileName.lastIndexOf("/") + 1)
					: d.fileName
			}
			${d.getText().substring(0, 512)}

			`;
			docContext;
			acc += doc;

			return acc;
		}, "");

		const linePrefix = document
			.lineAt(position)
			.text.substring(0, position.character);

		const prompt = `${docContext}
		
		${linePrefix}`;

		if (timeout) {
			clearTimeout(timeout);
		}

		try {
			return new Promise<InlineCompletionItem[]>((resolve, reject) => {
				timeout = setTimeout(() => {
					console.log("PROMPTING");

					this._model
						.execute(prompt)
						.then(({ response }) => {
							resolve([new InlineCompletionItem(response || "")]);
						})
						.catch((err) => reject([]));
				}, 500);
			});
		} catch (error) {
			return [];
		}
	}
}
