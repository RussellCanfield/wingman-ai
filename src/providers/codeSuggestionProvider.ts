import {
	CancellationToken,
	InlineCompletionContext,
	InlineCompletionItem,
	InlineCompletionItemProvider,
	Position,
	TextDocument,
} from "vscode";
import { eventEmitter } from "../events/eventEmitter";
import { AIProvider, AIStreamProvicer } from "../service/base";
import { delay } from "../service/delay";
import { getContentWindow } from "../service/utils/contentWindow";
import { InteractionSettings } from "@shared/types/Settings";
import { getSymbolsFromOpenFiles, supportedLanguages } from "./utilities";
import { getClipboardHistory } from "./clipboardTracker";
import NodeCache from "node-cache";
import { loggingProvider } from "./loggingProvider";

export class CodeSuggestionProvider implements InlineCompletionItemProvider {
	public static readonly selector = supportedLanguages;
	private cache: NodeCache;

	constructor(
		private readonly _aiProvider: AIProvider | AIStreamProvicer,
		private readonly _interactionSettings: InteractionSettings
	) {
		this.cache = new NodeCache({
			stdTTL: 300,
			maxKeys: 100,
			checkperiod: 120,
		});
	}

	async provideInlineCompletionItems(
		document: TextDocument,
		position: Position,
		context: InlineCompletionContext,
		token: CancellationToken
	) {
		if (!this._interactionSettings.codeCompletionEnabled) {
			return [];
		}

		let timeout: NodeJS.Timeout | undefined;

		const abort = new AbortController();
		const [prefix, suffix] = getContentWindow(
			document,
			position,
			this._interactionSettings.codeContextWindow
		);

		const types = await getSymbolsFromOpenFiles();

		token.onCancellationRequested(() => {
			try {
				if (timeout) {
					clearTimeout(timeout);
				}
				abort.abort();
			} finally {
				eventEmitter._onQueryComplete.fire();
			}
		});

		const delayMs = 350;
		try {
			await delay(delayMs);
			if (abort.signal.aborted) {
				return [new InlineCompletionItem("")];
			}
			return await this.bouncedRequest(
				prefix,
				abort.signal,
				suffix,
				this._interactionSettings.codeStreaming,
				types
			);
		} catch {
			return [new InlineCompletionItem("")];
		}
	}

	private generateCacheKey(prefix: string, suffix: string): string {
		return `${prefix.slice(-100)}:${suffix.slice(0, 100)}`;
	}

	async bouncedRequest(
		prefix: string,
		signal: AbortSignal,
		suffix: string,
		streaming: boolean,
		additionalContext?: string
	): Promise<InlineCompletionItem[]> {
		try {
			eventEmitter._onQueryStart.fire();
			const cacheKey = this.generateCacheKey(
				prefix.trim(),
				suffix.trim()
			);
			const cachedResult = this.cache.get<string>(cacheKey);

			if (cachedResult) {
				loggingProvider.logInfo(
					"Code complete - Serving from query cache"
				);
				return [new InlineCompletionItem(cachedResult)];
			}

			let result: string;

			if ("codeCompleteStream" in this._aiProvider && streaming) {
				result = await this._aiProvider.codeCompleteStream(
					prefix,
					suffix,
					signal,
					additionalContext,
					getClipboardHistory().join("\n\n")
				);
			} else {
				result = await this._aiProvider.codeComplete(
					prefix,
					suffix,
					signal,
					additionalContext,
					getClipboardHistory().join("\n\n")
				);
			}

			this.cache.set(cacheKey, result);
			return [new InlineCompletionItem(result)];
		} catch (error) {
			return [];
		} finally {
			eventEmitter._onQueryComplete.fire();
		}
	}
}
