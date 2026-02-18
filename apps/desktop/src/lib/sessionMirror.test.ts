import { describe, expect, test } from "vitest";
import type { SessionThread } from "./gatewayModels.js";
import {
	ensureSessionAssistantMessage,
	getSessionIdFromEventPayload,
	isSessionUserMessagePayload,
	normalizeIncomingGatewayAttachments,
	upsertSessionUserMessage,
} from "./sessionMirror.js";

function makeThread(partial: Partial<SessionThread>): SessionThread {
	return {
		id: "thread-1",
		name: "Thread",
		agentId: "main",
		messages: [],
		createdAt: Date.now(),
		updatedAt: Date.now(),
		messageCount: 0,
		lastMessagePreview: "",
		messagesLoaded: true,
		...partial,
	};
}

describe("sessionMirror", () => {
	test("extracts session id and user session message flags", () => {
		expect(getSessionIdFromEventPayload({ sessionId: "  a:b:c  " })).toBe("a:b:c");
		expect(getSessionIdFromEventPayload({ sessionId: "   " })).toBeUndefined();
		expect(
			isSessionUserMessagePayload({ type: "session-message", role: "user" }),
		).toBe(true);
		expect(
			isSessionUserMessagePayload({ type: "agent-stream", role: "assistant" }),
		).toBe(false);
	});

	test("normalizes incoming gateway attachments", () => {
		let id = 0;
		const nextId = () => `att-${++id}`;
		const attachments = normalizeIncomingGatewayAttachments(
			[
				{ kind: "image", dataUrl: "data:image/png;base64,abc", name: "img.png" },
				{ kind: "audio", dataUrl: "data:audio/wav;base64,abc", name: "voice.wav" },
				{ kind: "file", dataUrl: "data:text/plain;base64,abc", textContent: "hello" },
			],
			nextId,
		);

		expect(attachments).toHaveLength(3);
		expect(attachments[0].id).toBe("att-1");
		expect(attachments[0].kind).toBe("image");
		expect(attachments[1].kind).toBe("audio");
		expect(attachments[2].kind).toBe("file");
	});

	test("upserts user session message and dedupes by request id", () => {
		const payload = {
			type: "session-message",
			role: "user",
			sessionId: "agent:main:desktop:thread:abc",
			agentId: "main",
			content: "Hello from another client",
		};
		const first = upsertSessionUserMessage([], "req-1", payload, { now: 1000 });
		expect(first).toHaveLength(1);
		expect(first[0].messages).toHaveLength(1);
		expect(first[0].messages[0].content).toBe("Hello from another client");

		const second = upsertSessionUserMessage(first, "req-1", payload, { now: 2000 });
		expect(second[0].messages).toHaveLength(1);
	});

	test("ensures assistant placeholder for remote request and avoids duplicates", () => {
		const payload = {
			type: "agent-stream",
			sessionId: "agent:main:desktop:thread:xyz",
			agentId: "main",
		};

		const created = ensureSessionAssistantMessage([], "req-remote", payload, {
			now: 1000,
			defaultThreadName: "New Session",
		});
		expect(created.threadId).toBe("agent:main:desktop:thread:xyz");
		expect(created.threads).toHaveLength(1);
		expect(created.threads[0].messages).toHaveLength(1);
		expect(created.threads[0].messages[0].id).toBe("req-remote");

		const existingThread = makeThread({
			id: "agent:main:desktop:thread:xyz",
			messages: created.threads[0].messages,
			messageCount: 1,
		});
		const deduped = ensureSessionAssistantMessage([existingThread], "req-remote", payload, {
			now: 2000,
		});
		expect(deduped.threads[0].messages).toHaveLength(1);
	});
});
