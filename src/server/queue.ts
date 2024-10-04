import { Indexer } from "./files/indexer";

export type QueueProcessingCallback = (documents: string[]) => Promise<void>;

export class DocumentQueue {
	private queue: string[] = [];
	private queueSet: Set<string> = new Set();
	private timeoutId: NodeJS.Timeout | null = null;

	constructor(private readonly indexer: Indexer) {
		this.startProcessing();
	}

	enqueue = (documentUris: string[]) => {
		for (const uri of documentUris) {
			if (!this.queueSet.has(uri)) {
				this.queue.push(uri);
				this.queueSet.add(uri);
			}
		}

		if (this.timeoutId) {
			clearTimeout(this.timeoutId);
			this.startProcessing();
		}
	};

	private startProcessing = () => {
		this.timeoutId = setTimeout(async () => {
			if (this.indexer.isSyncing()) {
				return;
			}

			if (this.queueSet.size > 0) {
				const queueItems = Array.from(this.queueSet);
				this.queueSet.clear();
				await this.indexer.processDocuments(queueItems);
			}
		}, 10000).unref();
	};

	dispose = () => {
		this.queueSet.clear();
		if (this.timeoutId) {
			clearTimeout(this.timeoutId);
			this.timeoutId = null;
		}
	};

	getQueue = () => {
		return this.queue;
	};
}
