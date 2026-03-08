import { describe, expect, test } from "vitest";
import {
	checkGatewayConnection,
	clearProviderToken,
	clearSessionMessages,
	fetchSessionMessages,
	fetchNodes,
	fetchProviders,
	fetchVoiceConfig,
	getGatewayHttpBase,
	getGatewayWsUrl,
	mapSessionToThread,
	saveProviderToken,
	setNodeEnabled,
	speakVoice,
	submitSmsInboundMessage,
	updateVoiceConfig,
} from "./gatewayApi.js";
import { normalizeGatewaySettings } from "./gatewayConfig.js";

describe("gatewayApi URL helpers", () => {
	test("derives HTTP base from websocket settings", () => {
		const settings = normalizeGatewaySettings({
			url: "ws://127.0.0.1:18789/ws",
		});
		expect(getGatewayHttpBase(settings)).toBe("http://127.0.0.1:18789");
	});

	test("honors explicit uiUrl override", () => {
		const settings = normalizeGatewaySettings({
			url: "ws://127.0.0.1:18789/ws",
			uiUrl: "http://localhost:18790/",
		});
		expect(getGatewayHttpBase(settings)).toBe("http://localhost:18790");
	});

	test("converts http URL to websocket URL", () => {
		const settings = normalizeGatewaySettings({
			url: "https://example.com",
		});
		expect(getGatewayWsUrl(settings)).toBe("wss://example.com/ws");
	});

	test("normalizes wildcard localhost host for websocket URL", () => {
		const settings = normalizeGatewaySettings({
			url: "http://0.0.0.0:18789",
		});
		expect(getGatewayWsUrl(settings)).toBe("ws://127.0.0.1:18789/ws");
	});
});

describe("mapSessionToThread", () => {
	test("maps session fields to desktop thread model", () => {
		const thread = mapSessionToThread({
			id: "session-1",
			name: "Session One",
			agentId: "main",
			createdAt: 1700000000000,
			updatedAt: 1700000001000,
			messageCount: 4,
			lastMessagePreview: "hello",
			workdir: "/tmp",
		});

		expect(thread.id).toBe("session-1");
		expect(thread.messages).toEqual([]);
		expect(thread.messagesLoaded).toBe(false);
		expect(thread.workdir).toBe("/tmp");
	});
});

describe("checkGatewayConnection", () => {
	test("succeeds when at least one probe endpoint responds", async () => {
		const originalFetch = globalThis.fetch;
		globalThis.fetch = (async (input: RequestInfo | URL) => {
			const url = String(input);
			if (url.endsWith("/api/config")) {
				return new Response("not found", { status: 404 });
			}
			if (url.endsWith("/api/health")) {
				return new Response(JSON.stringify({ status: "ok" }), {
					status: 200,
					headers: { "Content-Type": "application/json" },
				});
			}
			if (url.endsWith("/api/stats")) {
				throw new Error("network down");
			}
			return new Response("unknown", { status: 404 });
		}) as unknown as typeof fetch;

		try {
			const settings = normalizeGatewaySettings({
				url: "ws://127.0.0.1:18789/ws",
			});
			const result = await checkGatewayConnection(settings);
			expect(result.ok).toBe(true);
			expect(result.health?.status).toBe("ok");
		} finally {
			globalThis.fetch = originalFetch;
		}
	});

	test("fails only when all probe endpoints fail", async () => {
		const originalFetch = globalThis.fetch;
		globalThis.fetch = (async () => {
			return new Response("bad", { status: 500 });
		}) as unknown as typeof fetch;

		try {
			const settings = normalizeGatewaySettings({
				url: "ws://127.0.0.1:18789/ws",
			});
			const result = await checkGatewayConnection(settings);
			expect(result.ok).toBe(false);
			expect(result.status).toBe("Gateway request failed");
			expect(result.error).toContain("config returned 500");
		} finally {
			globalThis.fetch = originalFetch;
		}
	});
});

describe("clearSessionMessages", () => {
	test("calls session messages delete endpoint", async () => {
		const originalFetch = globalThis.fetch;
		let capturedUrl = "";
		let capturedMethod = "";

		globalThis.fetch = (async (
			input: RequestInfo | URL,
			init?: RequestInit,
		) => {
			capturedUrl = String(input);
			capturedMethod = String(init?.method || "GET");
			return new Response(
				JSON.stringify({
					id: "session-1",
					messageCount: 0,
					lastMessagePreview: null,
				}),
				{
					status: 200,
					headers: { "Content-Type": "application/json" },
				},
			);
		}) as unknown as typeof fetch;

		try {
			const settings = normalizeGatewaySettings({
				url: "ws://127.0.0.1:18789/ws",
			});
			const result = await clearSessionMessages(settings, {
				sessionId: "session-1",
				agentId: "main",
			});
			expect(capturedMethod).toBe("DELETE");
			expect(capturedUrl).toContain(
				"/api/sessions/session-1/messages?agentId=main",
			);
			expect(result.messageCount).toBe(0);
		} finally {
			globalThis.fetch = originalFetch;
		}
	});
});

describe("fetchSessionMessages", () => {
	test("normalizes relative attachment media urls against the gateway base", async () => {
		const originalFetch = globalThis.fetch;
		globalThis.fetch = (async () => {
			return new Response(
				JSON.stringify([
					{
						id: "assistant-1",
						role: "assistant",
						content: "",
						attachments: [
							{
								id: "attachment-1",
								kind: "image",
								dataUrl: "/api/fs/file?path=%2Ftmp%2Fscreenshot.png",
								name: "screenshot.png",
							},
						],
						createdAt: 1,
					},
				]),
				{
					status: 200,
					headers: { "Content-Type": "application/json" },
				},
			);
		}) as unknown as typeof fetch;

		try {
			const settings = normalizeGatewaySettings({
				url: "ws://127.0.0.1:18789/ws",
			});
			const messages = await fetchSessionMessages(settings, {
				sessionId: "session-1",
				agentId: "main",
			});
			expect(messages[0]?.attachments?.[0]?.dataUrl).toBe(
				"http://127.0.0.1:18789/api/fs/file?path=%2Ftmp%2Fscreenshot.png",
			);
		} finally {
			globalThis.fetch = originalFetch;
		}
	});
});

describe("voice + providers APIs", () => {
	test("fetches providers", async () => {
		const originalFetch = globalThis.fetch;
		let authHeader = "";
		let passwordHeader = "";
		globalThis.fetch = (async (
			_input: RequestInfo | URL,
			init?: RequestInit,
		) => {
			const headers = new Headers(init?.headers);
			authHeader = headers.get("Authorization") || "";
			passwordHeader = headers.get("X-Wingman-Password") || "";
			return new Response(
				JSON.stringify({
					providers: [
						{
							name: "elevenlabs",
							label: "ElevenLabs",
							type: "api-key",
							envVars: ["ELEVENLABS_API_KEY"],
							category: "voice",
							source: "missing",
						},
					],
				}),
				{
					status: 200,
					headers: { "Content-Type": "application/json" },
				},
			);
		}) as unknown as typeof fetch;

		try {
			const settings = normalizeGatewaySettings({
				url: "ws://127.0.0.1:18789/ws",
				token: "desktop-token",
				password: "desktop-password",
			});
			const data = await fetchProviders(settings);
			expect(data.providers).toHaveLength(1);
			expect(data.providers[0].name).toBe("elevenlabs");
			expect(authHeader).toBe("Bearer desktop-token");
			expect(passwordHeader).toBe("desktop-password");
		} finally {
			globalThis.fetch = originalFetch;
		}
	});

	test("saves and clears provider token", async () => {
		const originalFetch = globalThis.fetch;
		const requests: Array<{ url: string; method: string }> = [];
		globalThis.fetch = (async (
			input: RequestInfo | URL,
			init?: RequestInit,
		) => {
			requests.push({
				url: String(input),
				method: String(init?.method || "GET"),
			});
			return new Response(JSON.stringify({ ok: true }), {
				status: 200,
				headers: { "Content-Type": "application/json" },
			});
		}) as unknown as typeof fetch;

		try {
			const settings = normalizeGatewaySettings({
				url: "ws://127.0.0.1:18789/ws",
			});
			await saveProviderToken(settings, {
				providerName: "elevenlabs",
				token: "test-token",
			});
			await clearProviderToken(settings, "elevenlabs");
			expect(requests[0].method).toBe("POST");
			expect(requests[0].url).toContain("/api/providers/elevenlabs");
			expect(requests[1].method).toBe("DELETE");
			expect(requests[1].url).toContain("/api/providers/elevenlabs");
		} finally {
			globalThis.fetch = originalFetch;
		}
	});

	test("fetches and updates voice config", async () => {
		const originalFetch = globalThis.fetch;
		globalThis.fetch = (async (
			input: RequestInfo | URL,
			init?: RequestInit,
		) => {
			const method = String(init?.method || "GET");
			if (method === "GET") {
				return new Response(
					JSON.stringify({
						voice: {
							provider: "web_speech",
							defaultPolicy: "manual",
						},
					}),
					{
						status: 200,
						headers: { "Content-Type": "application/json" },
					},
				);
			}
			return new Response(
				JSON.stringify({
					voice: {
						provider: "elevenlabs",
						defaultPolicy: "auto",
						elevenlabs: { voiceId: "voice-1" },
					},
				}),
				{
					status: 200,
					headers: { "Content-Type": "application/json" },
				},
			);
		}) as unknown as typeof fetch;

		try {
			const settings = normalizeGatewaySettings({
				url: "ws://127.0.0.1:18789/ws",
			});
			const current = await fetchVoiceConfig(settings);
			expect(current?.provider).toBe("web_speech");
			const updated = await updateVoiceConfig(settings, {
				provider: "elevenlabs",
			});
			expect(updated?.provider).toBe("elevenlabs");
			expect(updated?.elevenlabs?.voiceId).toBe("voice-1");
		} finally {
			globalThis.fetch = originalFetch;
		}
	});

	test("speakVoice returns audio blob and surfaces errors", async () => {
		const originalFetch = globalThis.fetch;
		globalThis.fetch = (async () => {
			return new Response("audio", {
				status: 200,
				headers: { "Content-Type": "audio/mpeg" },
			});
		}) as unknown as typeof fetch;

		try {
			const settings = normalizeGatewaySettings({
				url: "ws://127.0.0.1:18789/ws",
			});
			const blob = await speakVoice(settings, {
				text: "hello",
				agentId: "main",
			});
			expect(blob.type).toBe("audio/mpeg");
		} finally {
			globalThis.fetch = originalFetch;
		}

		globalThis.fetch = (async () => {
			return new Response("bad request", { status: 400 });
		}) as unknown as typeof fetch;
		try {
			const settings = normalizeGatewaySettings({
				url: "ws://127.0.0.1:18789/ws",
			});
			await expect(
				speakVoice(settings, {
					text: "hello",
				}),
			).rejects.toThrow("bad request");
		} finally {
			globalThis.fetch = originalFetch;
		}
	});
});

describe("sms inbound api", () => {
	test("posts SMS inbound payload and returns command resolution", async () => {
		const originalFetch = globalThis.fetch;
		let capturedUrl = "";
		let capturedMethod = "";
		let capturedAuth = "";
		let capturedPassword = "";

		globalThis.fetch = (async (
			input: RequestInfo | URL,
			init?: RequestInit,
		) => {
			capturedUrl = String(input);
			capturedMethod = String(init?.method || "GET");
			const headers = new Headers(init?.headers);
			capturedAuth = headers.get("Authorization") || "";
			capturedPassword = headers.get("X-Wingman-Password") || "";
			return new Response(
				JSON.stringify({
					kind: "command",
					handled: true,
					responseText: "Commands:",
					command: { name: "help" },
					policy: {
						target: "sms-macos:+15555550000",
						paused: false,
						pausedUntil: null,
						stopEnabled: false,
						alertMode: "important-only",
					},
				}),
				{
					status: 200,
					headers: { "Content-Type": "application/json" },
				},
			);
		}) as unknown as typeof fetch;

		try {
			const settings = normalizeGatewaySettings({
				url: "ws://127.0.0.1:18789/ws",
				token: "desktop-token",
				password: "desktop-password",
			});
			const result = await submitSmsInboundMessage(settings, {
				target: "sms-macos:+15555550000",
				text: "HELP",
			});
			expect(result.kind).toBe("command");
			expect(capturedMethod).toBe("POST");
			expect(capturedUrl).toContain("/api/sms/messages");
			expect(capturedAuth).toBe("Bearer desktop-token");
			expect(capturedPassword).toBe("desktop-password");
		} finally {
			globalThis.fetch = originalFetch;
		}
	});
});

describe("nodes api", () => {
	test("lists and toggles node enablement", async () => {
		const originalFetch = globalThis.fetch;
		const requests: Array<{ url: string; method: string; body?: string }> = [];
		globalThis.fetch = (async (
			input: RequestInfo | URL,
			init?: RequestInit,
		) => {
			const method = String(init?.method || "GET");
			const body = typeof init?.body === "string" ? init.body : undefined;
			requests.push({
				url: String(input),
				method,
				body,
			});
			if (method === "GET") {
				return new Response(
					JSON.stringify({
						nodes: [
							{
								clientId: "desktop-a",
								name: "Desktop A",
								enabled: true,
								connected: true,
								nodeIds: ["node-1"],
							},
						],
					}),
					{
						status: 200,
						headers: { "Content-Type": "application/json" },
					},
				);
			}
			return new Response(
				JSON.stringify({
					clientId: "desktop-a",
					name: "Desktop A",
					enabled: false,
					connected: false,
					nodeIds: [],
				}),
				{
					status: 200,
					headers: { "Content-Type": "application/json" },
				},
			);
		}) as unknown as typeof fetch;

		try {
			const settings = normalizeGatewaySettings({
				url: "ws://127.0.0.1:18789/ws",
			});
			const nodes = await fetchNodes(settings);
			expect(nodes).toHaveLength(1);
			expect(nodes[0]?.clientId).toBe("desktop-a");

			const updated = await setNodeEnabled(settings, {
				clientId: "desktop-a",
				enabled: false,
			});
			expect(updated.enabled).toBe(false);
			expect(requests[1]?.method).toBe("PUT");
			expect(requests[1]?.url).toContain("/api/nodes/desktop-a");
			expect(requests[1]?.body).toContain('"enabled":false');
		} finally {
			globalThis.fetch = originalFetch;
		}
	});
});
