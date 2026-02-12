import { describe, expect, it } from "vitest";
import type { GatewayMessage } from "../types";
import {
	createGatewayLangGraphTransport,
	type GatewaySocketClient,
	normalizeGatewayChunkToLangGraphEvents,
} from "./langgraphTransport";

class FakeGatewaySocket implements GatewaySocketClient {
	readonly sent: GatewayMessage[] = [];
	private readonly handlers = new Set<(message: GatewayMessage) => void>();

	send(message: GatewayMessage): void {
		this.sent.push(message);
	}

	subscribe(handler: (message: GatewayMessage) => void): () => void {
		this.handlers.add(handler);
		return () => this.handlers.delete(handler);
	}

	emit(message: GatewayMessage): void {
		for (const handler of this.handlers) {
			handler(message);
		}
	}
}

describe("normalizeGatewayChunkToLangGraphEvents", () => {
	it("maps tuple chunks directly to LangGraph events", () => {
		const events = normalizeGatewayChunkToLangGraphEvents([
			"evt-1",
			"messages",
			[{ type: "ai", content: "hello" }, { langgraph_node: "agent" }],
		]);

		expect(events).toEqual([
			{
				id: "evt-1",
				event: "messages",
				data: [{ type: "ai", content: "hello" }, { langgraph_node: "agent" }],
			},
		]);
	});

	it("passes through canonical LangGraph stream events", () => {
		const events = normalizeGatewayChunkToLangGraphEvents({
			id: "evt-2",
			event: "updates",
			data: { agent: { status: "running" } },
		});

		expect(events).toEqual([
			{
				id: "evt-2",
				event: "updates",
				data: { agent: { status: "running" } },
			},
		]);
	});

	it("maps LangChain callback chunks into events mode", () => {
		const events = normalizeGatewayChunkToLangGraphEvents({
			event: "on_tool_start",
			run_id: "tool-run-1",
			name: "read_file",
			data: { input: { file_path: "README.md" } },
		});

		expect(events).toEqual([
			{
				id: "tool-run-1",
				event: "events",
				data: {
					event: "on_tool_start",
					run_id: "tool-run-1",
					name: "read_file",
					data: { input: { file_path: "README.md" } },
				},
			},
		]);
	});
});

describe("createGatewayLangGraphTransport", () => {
	it("sends req:agent and emits metadata + stream events until completion", async () => {
		const socket = new FakeGatewaySocket();
		const transport = createGatewayLangGraphTransport({
			socket,
			agentId: "coding",
			requestIdFactory: () => "req-fixed-1",
			now: () => 1234,
		});
		const controller = new AbortController();
		const stream = await transport.stream({
			input: { messages: [{ role: "user", content: "ship it" }] },
			config: { configurable: { thread_id: "session-1" } },
			signal: controller.signal,
		});

		expect(socket.sent[0]).toMatchObject({
			type: "req:agent",
			id: "req-fixed-1",
			payload: {
				agentId: "coding",
				content: "ship it",
				queueIfBusy: true,
				sessionKey: "session-1",
			},
			timestamp: 1234,
		});

		socket.emit({
			type: "event:agent",
			id: "req-fixed-1",
			payload: { type: "agent-start" },
		});
		socket.emit({
			type: "event:agent",
			id: "req-fixed-1",
			payload: {
				type: "agent-stream",
				chunk: {
					event: "on_chat_model_stream",
					run_id: "llm-run-1",
					data: { chunk: { content: "Hello" } },
				},
			},
		});
		socket.emit({
			type: "event:agent",
			id: "req-fixed-1",
			payload: { type: "agent-complete" },
		});

		const first = await stream.next();
		expect(first.value).toEqual({
			event: "metadata",
			data: { run_id: "req-fixed-1", thread_id: "session-1" },
		});

		const second = await stream.next();
		expect(second.value).toEqual({
			id: "llm-run-1",
			event: "events",
			data: {
				event: "on_chat_model_stream",
				run_id: "llm-run-1",
				data: { chunk: { content: "Hello" } },
			},
		});

		const done = await stream.next();
		expect(done.done).toBe(true);
	});

	it("forwards agentId and attachments from submit input", async () => {
		const socket = new FakeGatewaySocket();
		const transport = createGatewayLangGraphTransport({
			socket,
			agentId: "fallback-agent",
			requestIdFactory: () => "req-fixed-attachments",
		});
		await transport.stream({
			input: {
				content: "check this file",
				agentId: "coding",
				attachments: [
					{ kind: "file", name: "README.md", textContent: "content" },
				],
			},
			config: { configurable: { thread_id: "session-2" } },
			signal: new AbortController().signal,
		});

		expect(socket.sent[0]).toMatchObject({
			type: "req:agent",
			id: "req-fixed-attachments",
			payload: {
				agentId: "coding",
				content: "check this file",
				attachments: [
					{ kind: "file", name: "README.md", textContent: "content" },
				],
				sessionKey: "session-2",
			},
		});
	});

	it("uses requestId from submit input when provided", async () => {
		const socket = new FakeGatewaySocket();
		const transport = createGatewayLangGraphTransport({
			socket,
			agentId: "fallback-agent",
			requestIdFactory: () => "req-should-not-be-used",
		});
		await transport.stream({
			input: {
				requestId: "req-direct-input",
				content: "check id",
			},
			config: { configurable: { thread_id: "session-3" } },
			signal: new AbortController().signal,
		});

		expect(socket.sent[0]).toMatchObject({
			type: "req:agent",
			id: "req-direct-input",
			payload: {
				agentId: "fallback-agent",
				content: "check id",
				sessionKey: "session-3",
			},
		});
	});

	it("emits an error event and closes when agent-error arrives", async () => {
		const socket = new FakeGatewaySocket();
		const transport = createGatewayLangGraphTransport({
			socket,
			agentId: "coding",
			requestIdFactory: () => "req-fixed-2",
		});
		const stream = await transport.stream({
			input: { content: "trigger error" },
			signal: new AbortController().signal,
		});

		socket.emit({
			type: "event:agent",
			id: "req-fixed-2",
			payload: { type: "agent-error", error: "Tool failure" },
		});

		const first = await stream.next();
		expect(first.value).toEqual({
			event: "error",
			data: { error: "AgentError", message: "Tool failure" },
		});
		const done = await stream.next();
		expect(done.done).toBe(true);
	});

	it("sends req:agent:cancel when aborted", async () => {
		const socket = new FakeGatewaySocket();
		const transport = createGatewayLangGraphTransport({
			socket,
			agentId: "coding",
			requestIdFactory: () => "req-fixed-3",
			now: () => 7777,
		});
		const controller = new AbortController();
		const stream = await transport.stream({
			input: { content: "long running task" },
			signal: controller.signal,
		});

		controller.abort();
		await new Promise((resolve) => setTimeout(resolve, 0));

		expect(socket.sent[1]).toMatchObject({
			type: "req:agent:cancel",
			id: "cancel-req-fixed-3",
			payload: { requestId: "req-fixed-3" },
			timestamp: 7777,
		});

		const done = await stream.next();
		expect(done.done).toBe(true);
	});
});
