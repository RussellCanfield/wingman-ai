import {
	CancellationToken,
	InlineCompletionContext,
	InlineCompletionItem,
	InlineCompletionItemProvider,
	Position,
	TextDocument,
} from "vscode";
import { eventEmitter } from "../events/eventEmitter";
import { AIProvider, AIStreamProvider } from "../service/base";
import { delay } from "../service/delay";
import { getContentWindow } from "../service/utils/contentWindow";
import { Settings } from "@shared/types/Settings";
import {
	extractCodeBlock,
	getSymbolsFromOpenFiles,
	supportedLanguages,
} from "./utilities";
import { getClipboardHistory } from "./clipboardTracker";
import NodeCache from "node-cache";
import { loggingProvider } from "./loggingProvider";
import {
	EVENT_CODE_COMPLETE,
	EVENT_CODE_COMPLETE_CACHE,
	telemetry,
} from "./telemetryProvider";

export class CodeSuggestionProvider implements InlineCompletionItemProvider {
	public static readonly selector = supportedLanguages;
	private cacheManager: CacheManager;

	constructor(
		private readonly _aiProvider: AIProvider | AIStreamProvider,
		private readonly _settings: Settings
	) {
		this.cacheManager = new CacheManager();
	}

	async provideInlineCompletionItems(
		document: TextDocument,
		position: Position,
		context: InlineCompletionContext,
		token: CancellationToken
	) {
		if (!this._settings.interactionSettings.codeCompletionEnabled) {
			return [];
		}

		let timeout: NodeJS.Timeout | undefined;

		const abort = new AbortController();
		const [prefix, suffix] = getContentWindow(
			document,
			position,
			this._settings.interactionSettings.codeContextWindow
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
				document,
				prefix,
				abort.signal,
				suffix,
				this._settings.interactionSettings.codeStreaming,
				types
			);
		} catch {
			return [new InlineCompletionItem("")];
		}
	}

	async bouncedRequest(
		document: TextDocument,
		prefix: string,
		signal: AbortSignal,
		suffix: string,
		streaming: boolean,
		additionalContext?: string
	): Promise<InlineCompletionItem[]> {
		try {
			eventEmitter._onQueryStart.fire();
			const cachedResult = this.cacheManager.get(
				document,
				prefix,
				suffix
			);

			if (cachedResult) {
				if (cachedResult === "") {
					return [];
				}
				loggingProvider.logInfo(
					"Code complete - Serving from query cache"
				);
				telemetry.sendEvent(EVENT_CODE_COMPLETE_CACHE, {
					language: document.languageId,
					aiProvider: this._settings.aiProvider,
					model:
						this._settings.providerSettings[
							this._settings.aiProvider
						]?.codeModel || "Unknown",
				});
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

			if (result.startsWith("```")) {
				result = extractCodeBlock(result);
			}

			loggingProvider.logInfo(
				`Code complete: \n${prefix}\n\n${suffix}\n\n${result}`
			);

			if (result === "") {
				return [];
			}

			try {
				telemetry.sendEvent(EVENT_CODE_COMPLETE, {
					language: document.languageId,
					aiProvider: this._settings.aiProvider,
					model:
						this._settings.providerSettings[
							this._settings.aiProvider
						]?.codeModel || "Unknown",
				});
			} catch {}

			this.cacheManager.set(document, prefix, suffix, result);
			return [new InlineCompletionItem(result)];
		} catch (error) {
			return [];
		} finally {
			eventEmitter._onQueryComplete.fire();
		}
	}
}

class CacheManager {
	private cache: NodeCache;
	private documentHashes: Map<string, string>;

	constructor() {
		this.cache = new NodeCache({
			stdTTL: 15,
			maxKeys: 100,
			checkperiod: 5,
		});
		this.documentHashes = new Map();
	}

	private generateCacheKey(
		document: TextDocument,
		prefix: string,
		suffix: string
	): string {
		return `${document.uri.fsPath}:${prefix.slice(-100)}:${suffix.slice(
			0,
			100
		)}`;
	}

	private generateDocumentHash(document: TextDocument): string {
		return Buffer.from(document.getText()).toString("base64").slice(0, 20);
	}

	set(
		document: TextDocument,
		prefix: string,
		suffix: string,
		value: string
	): void {
		const key = this.generateCacheKey(document, prefix, suffix);
		this.cache.set(key, value);
		this.documentHashes.set(
			document.uri.fsPath,
			this.generateDocumentHash(document)
		);
	}

	get(
		document: TextDocument,
		prefix: string,
		suffix: string
	): string | undefined {
		const key = this.generateCacheKey(document, prefix, suffix);
		const cachedHash = this.documentHashes.get(document.uri.fsPath);
		const currentHash = this.generateDocumentHash(document);

		if (cachedHash !== currentHash) {
			this.invalidateDocument(document.uri.fsPath);
			return undefined;
		}

		return this.cache.get<string>(key);
	}

	private invalidateDocument(fsPath: string): void {
		const keysToDelete = this.cache
			.keys()
			.filter((key) => key.startsWith(fsPath));
		keysToDelete.forEach((key) => this.cache.del(key));
		this.documentHashes.delete(fsPath);
	}
}
