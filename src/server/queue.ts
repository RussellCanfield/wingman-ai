export type QueueProcessingCallback = (textDocumentUri: string) => void;

export class DocumentQueue {
	private isProcessing = false;
	private queue: string[] = [];
	private queueSet: Set<string> = new Set();

	constructor(private readonly callback: QueueProcessingCallback) {
		this.startProcessing();
	}

	enqueue = (documentUris: string[]) => {
		for (const uri of documentUris) {
			if (!this.queueSet.has(uri)) {
				this.queue.push(uri);
				this.queueSet.add(uri);
			}
		}
	};

	*dequeueGenerator() {
		while (this.queue.length > 0) {
			const document = this.queue.shift();
			if (document) {
				this.queueSet.delete(document);
				yield document;
			}
		}
	}

	private startProcessing = () => {
		setInterval(() => {
			if (this.isProcessing) {
				return;
			}

			this.isProcessing = true;

			try {
				const generator = this.dequeueGenerator();
				for (let document of generator) {
					if (document) {
						this.callback(document);
					}
				}
			} finally {
				this.isProcessing = false;
			}
		}, 10000).unref();
	};

	getQueue = () => {
		return this.queue;
	};
}
