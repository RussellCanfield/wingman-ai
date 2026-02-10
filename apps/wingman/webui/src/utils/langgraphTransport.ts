import type { UseStreamTransport } from "@langchain/langgraph-sdk/react";
import type { GatewayMessage } from "../types";

type LangGraphEvent = {
	id?: string;
	event: string;
	data: unknown;
};

const LANGGRAPH_STREAM_EVENTS = new Set([
	"values",
	"messages",
	"updates",
	"events",
	"debug",
	"tasks",
	"checkpoints",
	"custom",
	"metadata",
	"error",
]);

export type GatewaySocketClient = {
	send: (message: GatewayMessage) => void;
	subscribe: (handler: (message: GatewayMessage) => void) => () => void;
};

type GatewayLangGraphTransportOptions = {
	socket: GatewaySocketClient;
	agentId: string;
	sessionId?: string;
	queueIfBusy?: boolean;
	requestIdFactory?: () => string;
	now?: () => number;
};

type StreamPayload = {
	input: unknown;
	context?: Record<string, unknown>;
	command?: unknown;
	config?: {
		configurable?: {
			thread_id?: string;
		};
	};
	signal: AbortSignal;
};

type AgentPayload = {
	type?: string;
	chunk?: unknown;
	error?: unknown;
	sessionId?: string;
};

class AsyncEventQueue<T> {
	private items: T[] = [];
	private waiters: Array<(result: IteratorResult<T>) => void> = [];
	private closed = false;

	push(item: T): void {
		if (this.closed) return;
		const waiter = this.waiters.shift();
		if (waiter) {
			waiter({ value: item, done: false });
			return;
		}
		this.items.push(item);
	}

	close(): void {
		if (this.closed) return;
		this.closed = true;
		while (this.waiters.length > 0) {
			const waiter = this.waiters.shift();
			waiter?.({ value: undefined as T, done: true });
		}
	}

	async next(): Promise<IteratorResult<T>> {
		if (this.items.length > 0) {
			const value = this.items.shift() as T;
			return { value, done: false };
		}
		if (this.closed) {
			return { value: undefined as T, done: true };
		}
		return await new Promise<IteratorResult<T>>((resolve) => {
			this.waiters.push(resolve);
		});
	}
}

const asRecord = (value: unknown): Record<string, unknown> | null => {
	if (!value || typeof value !== "object" || Array.isArray(value)) {
		return null;
	}
	return value as Record<string, unknown>;
};

const asString = (value: unknown): string | undefined => {
	if (typeof value !== "string") return undefined;
	const normalized = value.trim();
	return normalized.length > 0 ? normalized : undefined;
};

const isLangGraphStreamEvent = (event: string): boolean => {
	return LANGGRAPH_STREAM_EVENTS.has(event) || event.includes("|");
};

const extractTextFromMessageContent = (
	content: unknown,
): string | undefined => {
	if (typeof content === "string") return content;
	if (Array.isArray(content)) {
		const textParts = content
			.map((part) => {
				const record = asRecord(part);
				if (!record) return "";
				if (record.type !== "text") return "";
				return typeof record.text === "string" ? record.text : "";
			})
			.filter(Boolean);
		if (textParts.length > 0) {
			return textParts.join("");
		}
	}
	return undefined;
};

const extractPromptText = (input: unknown): string => {
	if (typeof input === "string") {
		return input;
	}
	const inputRecord = asRecord(input);
	if (!inputRecord) {
		return input == null ? "" : String(input);
	}
	const directContent = extractTextFromMessageContent(inputRecord.content);
	if (directContent) {
		return directContent;
	}
	const messages = Array.isArray(inputRecord.messages)
		? inputRecord.messages
		: [];
	for (let index = messages.length - 1; index >= 0; index -= 1) {
		const messageRecord = asRecord(messages[index]);
		if (!messageRecord) continue;
		const role = asString(messageRecord.role)?.toLowerCase();
		if (role && role !== "user" && role !== "human") continue;
		const content = extractTextFromMessageContent(messageRecord.content);
		if (content) return content;
	}
	return "";
};

const normalizeAgentError = (error: unknown): string => {
	if (typeof error === "string" && error.trim()) return error.trim();
	const record = asRecord(error);
	if (record) {
		if (typeof record.message === "string" && record.message.trim()) {
			return record.message.trim();
		}
		if (typeof record.error === "string" && record.error.trim()) {
			return record.error.trim();
		}
	}
	return "Agent stream failed";
};

export const normalizeGatewayChunkToLangGraphEvents = (
	chunk: unknown,
): LangGraphEvent[] => {
	if (Array.isArray(chunk) && chunk.length >= 3) {
		const event = asString(chunk[1]);
		if (!event) return [];
		return [
			{
				id: asString(chunk[0]),
				event,
				data: chunk[2],
			},
		];
	}

	const record = asRecord(chunk);
	if (!record) return [];
	const event = asString(record.event);
	if (!event) return [];

	if (isLangGraphStreamEvent(event)) {
		return [
			{
				id: asString(record.id),
				event,
				data: record.data,
			},
		];
	}

	// LangChain callback events can still be forwarded as LangGraph "events" mode.
	if (event.startsWith("on_")) {
		return [
			{
				id: asString(record.run_id) || asString(record.id),
				event: "events",
				data: record,
			},
		];
	}

	return [];
};

export const createGatewayLangGraphTransport = (
	options: GatewayLangGraphTransportOptions,
): UseStreamTransport<Record<string, unknown>> => {
	const requestIdFactory =
		options.requestIdFactory ||
		(() => `req-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`);
	const now = options.now || (() => Date.now());
	const queueIfBusy = options.queueIfBusy !== false;

	return {
		async stream(payload: StreamPayload) {
			const requestId = requestIdFactory();
			const threadId =
				asString(payload?.config?.configurable?.thread_id) || options.sessionId;
			const promptText = extractPromptText(payload.input);
			const queue = new AsyncEventQueue<LangGraphEvent>();
			let unsubscribed = false;

			const unsubscribe = options.socket.subscribe((message) => {
				if (message.type !== "event:agent") return;
				if (message.id !== requestId) return;
				const agentPayload = (message.payload || {}) as AgentPayload;
				if (agentPayload.type === "agent-start") {
					if (threadId) {
						queue.push({
							event: "metadata",
							data: { run_id: requestId, thread_id: threadId },
						});
					}
					return;
				}
				if (agentPayload.type === "agent-stream") {
					for (const event of normalizeGatewayChunkToLangGraphEvents(
						agentPayload.chunk,
					)) {
						queue.push(event);
					}
					return;
				}
				if (agentPayload.type === "agent-error") {
					queue.push({
						event: "error",
						data: {
							error: "AgentError",
							message: normalizeAgentError(agentPayload.error),
						},
					});
					cleanup();
					queue.close();
					return;
				}
				if (agentPayload.type === "agent-complete") {
					cleanup();
					queue.close();
				}
			});

			const cleanup = () => {
				if (unsubscribed) return;
				unsubscribed = true;
				unsubscribe();
				payload.signal.removeEventListener("abort", onAbort);
			};

			const onAbort = () => {
				options.socket.send({
					type: "req:agent:cancel",
					id: `cancel-${requestId}`,
					payload: { requestId },
					timestamp: now(),
				});
				cleanup();
				queue.close();
			};

			payload.signal.addEventListener("abort", onAbort);

			options.socket.send({
				type: "req:agent",
				id: requestId,
				payload: {
					agentId: options.agentId,
					content: promptText,
					queueIfBusy,
					...(threadId ? { sessionKey: threadId } : {}),
				},
				timestamp: now(),
			});

			const iterator: AsyncGenerator<LangGraphEvent> = {
				[Symbol.asyncIterator]() {
					return this;
				},
				next: async () => {
					return await queue.next();
				},
				return: async () => {
					cleanup();
					queue.close();
					return { value: undefined, done: true };
				},
				throw: async (error?: unknown) => {
					cleanup();
					queue.close();
					throw error;
				},
			};
			return iterator;
		},
	};
};
