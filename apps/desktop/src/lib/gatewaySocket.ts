import { getGatewayWsUrl } from "./gatewayApi.js";
import type {
	AgentRequestPayload,
	GatewayMessage,
	GatewaySettings,
	NodeInvokePayload,
} from "./gatewayModels.js";
import { invokeTauri, isTauriRuntime } from "./tauriBridge.js";

export type GatewaySocketEventHandlers = {
	onConnectionChanged?: (connected: boolean, message: string) => void;
	onAgentEvent?: (requestId: string, payload: unknown) => void;
	onError?: (
		message: string,
		context?: { requestId?: string; payload?: unknown },
	) => void;
};

function normalizeNonEmptyString(value: unknown): string | undefined {
	if (typeof value !== "string") return undefined;
	const trimmed = value.trim();
	return trimmed.length > 0 ? trimmed : undefined;
}

function asRecord(value: unknown): Record<string, unknown> | null {
	if (!value || typeof value !== "object" || Array.isArray(value)) {
		return null;
	}
	return value as Record<string, unknown>;
}

function extractGatewayErrorMessage(payload: unknown): string {
	const direct = normalizeNonEmptyString(payload);
	if (direct) return direct;
	const record = asRecord(payload);
	if (!record) return "Gateway returned an error";
	const details = asRecord(record.details);
	const candidates = [
		record.message,
		record.error,
		details?.message,
		details?.error,
	];
	for (const candidate of candidates) {
		const text = normalizeNonEmptyString(candidate);
		if (text) return text;
	}
	return "Gateway returned an error";
}

function extractGatewayErrorRequestId(
	messageId: unknown,
	payload: unknown,
): string | undefined {
	const payloadRecord = asRecord(payload);
	const details = payloadRecord ? asRecord(payloadRecord.details) : null;
	const candidates = [
		messageId,
		payloadRecord?.requestId,
		payloadRecord?.request_id,
		payloadRecord?.id,
		details?.requestId,
		details?.request_id,
		details?.id,
	];
	for (const candidate of candidates) {
		const requestId = normalizeNonEmptyString(candidate);
		if (requestId) return requestId;
	}
	return undefined;
}

export class GatewaySocketClient {
	private socket: WebSocket | null = null;
	private handlers: GatewaySocketEventHandlers;
	private connectRequestId: string | null = null;
	private settings: GatewaySettings | null = null;
	private deviceId: string | null = null;
	private subscribedSessions = new Set<string>();

	constructor(handlers: GatewaySocketEventHandlers = {}) {
		this.handlers = handlers;
	}

	setHandlers(handlers: GatewaySocketEventHandlers): void {
		this.handlers = handlers;
	}

	isConnected(): boolean {
		return this.socket?.readyState === WebSocket.OPEN;
	}

	connect(settings: GatewaySettings, deviceId: string): void {
		this.disconnect();
		this.settings = settings;
		this.deviceId = deviceId;
		const wsUrl = getGatewayWsUrl(settings);
		if (!wsUrl) {
			this.handlers.onError?.("Gateway WS URL is invalid");
			return;
		}

		this.handlers.onConnectionChanged?.(false, "Connecting to gateway...");
		const ws = new WebSocket(wsUrl);
		this.socket = ws;

		ws.onopen = () => {
			const requestId = `connect-${Date.now()}`;
			this.connectRequestId = requestId;
			const connectMessage: GatewayMessage = {
				type: "connect",
				id: requestId,
				client: {
					instanceId: `desktop-${deviceId}`,
					clientType: "desktop",
					version: "0.1",
				},
				auth: {
					token: settings.token || undefined,
					password: settings.password || undefined,
				},
				timestamp: Date.now(),
			};
			ws.send(JSON.stringify(connectMessage));
		};

		ws.onmessage = (event) => {
			let msg: GatewayMessage;
			try {
				msg = JSON.parse(event.data as string) as GatewayMessage;
			} catch {
				this.handlers.onError?.("Received malformed gateway message");
				return;
			}

			if (msg.type === "res" && msg.id && msg.id === this.connectRequestId) {
				if (msg.ok) {
					this.handlers.onConnectionChanged?.(true, "Gateway connected");
				} else {
					this.handlers.onConnectionChanged?.(false, "Gateway authentication failed");
					this.handlers.onError?.(String(msg.payload || "Gateway authentication failed"));
					ws.close();
				}
				return;
			}

			if (msg.type === "event:agent" && msg.id) {
				this.handlers.onAgentEvent?.(msg.id, msg.payload);
				return;
			}

			if (msg.type === "req:node" && msg.id) {
				void this.handleNodeRequest(msg.id, msg.payload as NodeInvokePayload);
				return;
			}

			if (msg.type === "error") {
				this.handlers.onError?.(extractGatewayErrorMessage(msg.payload), {
					requestId: extractGatewayErrorRequestId(msg.id, msg.payload),
					payload: msg.payload,
				});
			}
		};

		ws.onerror = () => {
			this.handlers.onConnectionChanged?.(false, "WebSocket error");
			this.handlers.onError?.(`WebSocket transport error at ${wsUrl}`);
		};

		ws.onclose = (event) => {
			const code = event.code ? ` (${event.code})` : "";
			const reason = event.reason ? `: ${event.reason}` : "";
			this.handlers.onConnectionChanged?.(false, `Gateway disconnected${code}${reason}`);
		};
	}

	disconnect(): void {
		if (this.socket) {
			this.socket.close();
			this.socket = null;
		}
		this.subscribedSessions.clear();
		this.connectRequestId = null;
		this.settings = null;
		this.deviceId = null;
	}

	sendAgentRequest(payload: AgentRequestPayload): string {
		const ws = this.socket;
		if (!ws || ws.readyState !== WebSocket.OPEN) {
			throw new Error("Gateway socket is not connected");
		}
		const requestId = `req-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
		const message: GatewayMessage = {
			type: "req:agent",
			id: requestId,
			payload,
			timestamp: Date.now(),
		};
		ws.send(JSON.stringify(message));
		return requestId;
	}

	subscribeSession(sessionId: string): void {
		if (this.subscribedSessions.has(sessionId)) return;
		if (!this.isConnected() || !this.socket) return;

		const message: GatewayMessage = {
			type: "session_subscribe",
			payload: { sessionId },
			timestamp: Date.now(),
		};
		this.socket.send(JSON.stringify(message));
		this.subscribedSessions.add(sessionId);
	}

	unsubscribeSession(sessionId: string): void {
		if (!this.subscribedSessions.has(sessionId)) return;
		if (!this.isConnected() || !this.socket) {
			this.subscribedSessions.delete(sessionId);
			return;
		}

		const message: GatewayMessage = {
			type: "session_unsubscribe",
			payload: { sessionId },
			timestamp: Date.now(),
		};
		this.socket.send(JSON.stringify(message));
		this.subscribedSessions.delete(sessionId);
	}

	enableNode(options?: { name?: string; capabilities?: string[] }): void {
		const ws = this.socket;
		if (!ws || ws.readyState !== WebSocket.OPEN) {
			throw new Error("Gateway socket is not connected");
		}
		const payload = {
			name:
				options?.name?.trim() ||
				(this.deviceId ? `desktop-node-${this.deviceId}` : "desktop-node"),
			capabilities: options?.capabilities || ["system.notify", "system.run"],
			token: this.settings?.token?.trim() || undefined,
			agentName: "desktop",
		};
		ws.send(
			JSON.stringify({
				type: "register",
				payload,
				timestamp: Date.now(),
			} satisfies GatewayMessage),
		);
	}

	disableNode(): void {
		const ws = this.socket;
		if (!ws || ws.readyState !== WebSocket.OPEN) return;
		ws.send(
			JSON.stringify({
				type: "unregister",
				timestamp: Date.now(),
			} satisfies GatewayMessage),
		);
	}

	private async handleNodeRequest(
		requestId: string,
		payload: NodeInvokePayload | undefined,
	): Promise<void> {
		const tool = payload?.tool;
		if (!tool) {
			this.sendNodeError(requestId, "invalid-request", "Missing tool name");
			return;
		}
		try {
			if (tool === "system.notify") {
				if (!isTauriRuntime()) {
					throw new Error("system.notify is unavailable outside Tauri runtime");
				}
				const title =
					typeof payload.args?.title === "string"
						? payload.args.title.trim()
						: "Wingman Desktop";
				const body =
					typeof payload.args?.body === "string"
						? payload.args.body.trim()
						: "";
				if (!body) {
					throw new Error("system.notify requires a non-empty body");
				}
				await invokeTauri<void>("send_notification", {
					title,
					body,
				});
				this.sendNodeResult(requestId, {
					tool,
					delivered: true,
				});
				return;
			}
			if (tool === "system.run") {
				if (!isTauriRuntime()) {
					throw new Error("system.run is unavailable outside Tauri runtime");
				}
				const command =
					typeof payload.args?.command === "string"
						? payload.args.command.trim()
						: "";
				const args = Array.isArray(payload.args?.args)
					? payload.args?.args
							.map((item) => (typeof item === "string" ? item : ""))
							.filter((item) => item.length > 0)
					: [];
				if (!command) {
					throw new Error("system.run requires a command string");
				}
				const result = await invokeTauri<{
					exitCode: number;
					stdout: string;
					stderr: string;
				}>("run_system_command", {
					command,
					args,
				});
				if (!result) {
					throw new Error("system.run is unavailable outside Tauri runtime");
				}
				this.sendNodeResult(requestId, {
					tool,
					...result,
				});
				return;
			}
			this.sendNodeError(
				requestId,
				"unsupported-tool",
				`Unsupported node tool: ${tool}`,
			);
		} catch (error) {
			this.sendNodeError(
				requestId,
				"node-tool-error",
				error instanceof Error ? error.message : String(error),
			);
		}
	}

	private sendNodeResult(requestId: string, payload: unknown): void {
		const ws = this.socket;
		if (!ws || ws.readyState !== WebSocket.OPEN) return;
		const message: GatewayMessage = {
			type: "res",
			id: requestId,
			ok: true,
			payload,
			timestamp: Date.now(),
		};
		ws.send(JSON.stringify(message));
	}

	private sendNodeError(requestId: string, code: string, message: string): void {
		const ws = this.socket;
		if (!ws || ws.readyState !== WebSocket.OPEN) return;
		const response: GatewayMessage = {
			type: "error",
			id: requestId,
			payload: {
				code,
				message,
			},
			timestamp: Date.now(),
		};
		ws.send(JSON.stringify(response));
	}
}
