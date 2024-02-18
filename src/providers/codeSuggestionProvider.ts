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
import { eventEmitter } from "../events/eventEmitter";
import { AIProvider, AIStreamProvicer } from "../service/base";
import { delay } from '../service/delay';
import { InteractionSettings } from "../types/Settings";

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

	constructor(
		private readonly _aiProvider: AIProvider | AIStreamProvicer,
		private readonly _interactionSettings: InteractionSettings
	) { }



	async provideInlineCompletionItems(
		document: TextDocument,
		position: Position,
		context: InlineCompletionContext,
		token: CancellationToken
	) {
		let timeout: NodeJS.Timeout | undefined;

		const abort = new AbortController();
		const [prefix, suffix] = this.getContentWindow(document, position);

		token.onCancellationRequested(() => {
			try {
				if (timeout) {
					clearTimeout(timeout);
				}
				abort.abort();
			}
			finally {
				eventEmitter._onQueryComplete.fire();
			}
		});

		const delayMs = this._interactionSettings.codeStreaming ? 300 : 300;
		try {
			await delay(delayMs);
			if (abort.signal.aborted) {
				return [new InlineCompletionItem('')];
			}
			return await this.bouncedRequest(prefix, abort.signal, suffix, this._interactionSettings.codeStreaming);
		}
		catch {
			return [new InlineCompletionItem('')];
		}
	}

	private getContentWindow(document: TextDocument, position: Position) {
		let prefix: string = '';
		let suffix: string = '';
		const length = this._interactionSettings.codeContextWindow;
		let tokenCount = 0;
		const text = document.getText();
		let current = document.offsetAt(position);
		let top = current;
		let bottom = current;

		// every 3 chars we add a new token to the token count
		let letCurrentChatToTokenCount = 0;
		while (tokenCount < length && (top > -1 || bottom < text.length)) {
			if (top > -1) {
				letCurrentChatToTokenCount++;
				top--;
			}

			if (letCurrentChatToTokenCount === 3) {
				tokenCount++;
				letCurrentChatToTokenCount = 0;
			}

			if (bottom < text.length) {
				letCurrentChatToTokenCount++;
				bottom++;
			}

			if (letCurrentChatToTokenCount === 3) {
				tokenCount++;
				letCurrentChatToTokenCount = 0;
			}
		}
		prefix = text.substring(top, current);
		suffix = text.substring(current, bottom);
		return [prefix, suffix];
	}

	async bouncedRequest(
		prefix: string,
		signal: AbortSignal,
		suffix: string,
		streaming: boolean
	): Promise<InlineCompletionItem[]> {
		try {
			eventEmitter._onQueryStart.fire();
			if ('codeCompleteStream' in this._aiProvider && streaming) {
				const codeStream = await this._aiProvider.codeCompleteStream(prefix, suffix, signal);
				return [new InlineCompletionItem(codeStream)];
			}
			else {
				const codeResponse = await this._aiProvider.codeComplete(
					prefix,
					suffix,
					signal
				);
				return [new InlineCompletionItem(codeResponse)];
			}
		} catch (error) {
			return [];
		}
		finally {
			eventEmitter._onQueryComplete.fire();
		}
	}
}
