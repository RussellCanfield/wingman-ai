import {
	CancellationToken,
	DocumentSelector,
	InlineCompletionContext,
	InlineCompletionItem,
	InlineCompletionItemProvider,
	Position,
	TextDocument,
} from "vscode";
import { BaseModel } from "../service/llm";

let timeout: NodeJS.Timeout | undefined;

export class CodeSuggestionProvider implements InlineCompletionItemProvider {
	public static readonly selector: DocumentSelector = [
		{ pattern: "**/*.tsx" },
		{ pattern: "**/*.ts" },
		{ pattern: "**/*.js" },
		{ pattern: "**/*.jsx" },
	];

	private model: BaseModel;

	constructor(model: BaseModel) {
		this.model = model;
	}

	sanitizeResult = (text: string) => {
		console.log(text);
		const regex = /\`\`\`(\w+)([\s\S]*?)\`\`\`/gm;
		const match = regex.exec(text);
		console.log(match);
		return match ? match[2] : null;
	};

	provideInlineCompletionItems(
		document: TextDocument,
		position: Position,
		context: InlineCompletionContext,
		token: CancellationToken
	) {
		const linePrefix = document
			.lineAt(position)
			.text.substr(0, position.character);

		// if (!linePrefix.endsWith("code-assistant.")) {
		// 	return undefined;
		// }

		if (timeout) {
			clearTimeout(timeout);
		}

		try {
			return new Promise<InlineCompletionItem[]>((resolve, reject) => {
				timeout = setTimeout(() => {
					this.model
						.getResponse(linePrefix)
						.then(({ response }) => {
							const code = this.sanitizeResult(response)?.replace(
								/\\n/g,
								""
							);
							resolve([new InlineCompletionItem(code || "")]);
						})
						.catch(() => {
							reject([]);
						});
				}, 500);
			});
		} catch (error) {
			return [];
		}
	}
}
