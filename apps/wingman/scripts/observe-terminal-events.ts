#!/usr/bin/env bun

import {
	formatTerminalProbeEvent,
	shouldReportTerminalProbeEvent,
	type TerminalProbeEventType,
} from "../src/debug/terminalProbe.ts";
import {
	formatTerminalProbeHandshakeFailure,
	resolveTerminalProbeAuth,
	TERMINAL_PROBE_GATEWAY_PASSWORD_ENV,
	TERMINAL_PROBE_GATEWAY_TOKEN_ENV,
} from "../src/debug/terminalProbeAuth.ts";

type CliOptions = {
	host: string;
	port: number;
	sessionId?: string;
	requestId?: string;
	token?: string;
	password?: string;
	timeoutSeconds: number;
	verbose: boolean;
};

function printUsage(): void {
	console.log(`Usage:
  bun ./scripts/observe-terminal-events.ts [options]

Options:
  --host <host>         Gateway host (default: 127.0.0.1)
  --port <port>         Gateway port (default: 18789)
  --session <id>        Session id to observe (optional)
  --request <id>        Optional request id filter
  --token <token>       Optional gateway token
  --password <pass>     Optional gateway password
  --timeout <seconds>   Auto-exit timeout (default: 300)
  --verbose             Include agent-start/request-queued
  --help                Show this message

Notes:
  - With --session, the probe subscribes directly to that session.
  - Without --session, the probe auto-discovers sessions from UI user messages
    and auto-subscribes to them.
  - Auth resolution priority: --token/--password, env
    (${TERMINAL_PROBE_GATEWAY_TOKEN_ENV}/${TERMINAL_PROBE_GATEWAY_PASSWORD_ENV}),
    then .wingman/wingman.config.json.
`);
}

function parseCliArgs(argv: string[]): CliOptions | null {
	const options: CliOptions = {
		host: "127.0.0.1",
		port: 18789,
		timeoutSeconds: 300,
		verbose: false,
	};

	for (let index = 0; index < argv.length; index += 1) {
		const arg = argv[index];
		if (arg === "--help" || arg === "-h") return null;
		if (arg === "--verbose") {
			options.verbose = true;
			continue;
		}

		const next = argv[index + 1];
		if (arg === "--host" && next) {
			options.host = next;
			index += 1;
			continue;
		}
		if (arg === "--port" && next) {
			const parsed = Number.parseInt(next, 10);
			if (!Number.isFinite(parsed) || parsed <= 0) {
				throw new Error(`Invalid --port value: ${next}`);
			}
			options.port = parsed;
			index += 1;
			continue;
		}
		if (arg === "--session" && next) {
			options.sessionId = next;
			index += 1;
			continue;
		}
		if (arg === "--request" && next) {
			options.requestId = next;
			index += 1;
			continue;
		}
		if (arg === "--token" && next) {
			options.token = next;
			index += 1;
			continue;
		}
		if (arg === "--password" && next) {
			options.password = next;
			index += 1;
			continue;
		}
		if (arg === "--timeout" && next) {
			const parsed = Number.parseInt(next, 10);
			if (!Number.isFinite(parsed) || parsed < 0) {
				throw new Error(`Invalid --timeout value: ${next}`);
			}
			options.timeoutSeconds = parsed;
			index += 1;
			continue;
		}

		throw new Error(`Unknown or incomplete argument: ${arg}`);
	}

	if (options.sessionId && !options.sessionId.trim()) {
		throw new Error("Invalid --session value");
	}

	return options;
}

function asRecord(value: unknown): Record<string, unknown> | null {
	if (!value || typeof value !== "object" || Array.isArray(value)) {
		return null;
	}
	return value as Record<string, unknown>;
}

function asString(value: unknown): string | undefined {
	return typeof value === "string" ? value : undefined;
}

function parseGatewayMessage(raw: unknown): {
	type?: string;
	id?: string;
	ok?: boolean;
	payload?: unknown;
} | null {
	const record = asRecord(raw);
	if (!record) return null;
	return {
		type: asString(record.type),
		id: asString(record.id),
		ok: typeof record.ok === "boolean" ? record.ok : undefined,
		payload: record.payload,
	};
}

function buildProbeEvent(input: {
	payloadType: TerminalProbeEventType;
	requestId: string;
	payload: Record<string, unknown>;
}): {
	type: TerminalProbeEventType;
	requestId: string;
	sessionId?: string;
	error?: string;
	timestampIso: string;
} {
	return {
		type: input.payloadType,
		requestId: input.requestId,
		sessionId: asString(input.payload.sessionId),
		error: asString(input.payload.error),
		timestampIso: new Date().toISOString(),
	};
}

async function main(): Promise<void> {
	const parsed = parseCliArgs(process.argv.slice(2));
	if (!parsed) {
		printUsage();
		process.exit(0);
	}

	const options = parsed;
	const resolvedAuth = resolveTerminalProbeAuth({
		cliToken: options.token,
		cliPassword: options.password,
	});
	const wsUrl = `ws://${options.host}:${options.port}/ws`;
	const clientInstanceId = `terminal-probe-${Date.now()}`;
	const connectId = `connect-${clientInstanceId}`;
	const subscribedSessions = new Set<string>();
	const pendingSubscriptions = new Set<string>();

	console.log(
		`[terminal-probe] connecting to ${wsUrl}${
			options.sessionId ? `, session=${options.sessionId}` : ", session=auto"
		}${options.requestId ? `, request=${options.requestId}` : ""}${
			resolvedAuth.source === "none"
				? ", auth=none"
				: `, auth=${resolvedAuth.source}`
		}`,
	);
	if (resolvedAuth.source === "config" && resolvedAuth.configPath) {
		console.log(
			`[terminal-probe] loaded gateway auth from ${resolvedAuth.configPath}`,
		);
	}

	const ws = new WebSocket(wsUrl);
	let done = false;
	let hasSessionSubscription = false;
	let startupTimer: ReturnType<typeof setTimeout> | null = null;
	let timeoutTimer: ReturnType<typeof setTimeout> | null = null;

	const finish = (code: number, message?: string) => {
		if (done) return;
		done = true;
		if (startupTimer) {
			clearTimeout(startupTimer);
			startupTimer = null;
		}
		if (timeoutTimer) {
			clearTimeout(timeoutTimer);
			timeoutTimer = null;
		}
		if (message) {
			console.log(message);
		}
		try {
			ws.close();
		} catch {
			// ignore close errors during shutdown
		}
		process.exit(code);
	};

	const subscribeToSession = (sessionId: string) => {
		const normalized = sessionId.trim();
		if (!normalized) return;
		if (
			subscribedSessions.has(normalized) ||
			pendingSubscriptions.has(normalized)
		) {
			return;
		}
		pendingSubscriptions.add(normalized);
		ws.send(
			JSON.stringify({
				type: "session_subscribe",
				id: `sub-${clientInstanceId}-${Date.now()}`,
				payload: { sessionId: normalized },
				timestamp: Date.now(),
			}),
		);
	};

	process.on("SIGINT", () => {
		finish(0, "[terminal-probe] stopped");
	});

	startupTimer = setTimeout(() => {
		finish(1, "[terminal-probe] connection/subscribe timeout");
	}, 10_000);

	if (options.timeoutSeconds > 0) {
		timeoutTimer = setTimeout(() => {
			finish(0, "[terminal-probe] timeout reached");
		}, options.timeoutSeconds * 1000);
	}

	ws.addEventListener("open", () => {
		const connectMessage: Record<string, unknown> = {
			type: "connect",
			id: connectId,
			client: {
				instanceId: clientInstanceId,
				clientType: "webui",
				version: "0.1",
			},
			timestamp: Date.now(),
		};
		if (resolvedAuth.token || resolvedAuth.password) {
			connectMessage.auth = {
				...(resolvedAuth.token ? { token: resolvedAuth.token } : {}),
				...(resolvedAuth.password ? { password: resolvedAuth.password } : {}),
			};
		}
		ws.send(JSON.stringify(connectMessage));
	});

	ws.addEventListener("error", () => {
		finish(1, "[terminal-probe] websocket error");
	});

	ws.addEventListener("close", () => {
		if (!done) {
			finish(
				hasSessionSubscription ? 0 : 1,
				hasSessionSubscription
					? "[terminal-probe] websocket closed"
					: "[terminal-probe] disconnected before subscribe",
			);
		}
	});

	ws.addEventListener("message", (event) => {
		const parsedMessage = (() => {
			try {
				return parseGatewayMessage(JSON.parse(String(event.data)));
			} catch {
				return null;
			}
		})();

		if (!parsedMessage) return;

		if (parsedMessage.type === "res" && parsedMessage.id === connectId) {
			if (!parsedMessage.ok) {
				const reason = formatTerminalProbeHandshakeFailure(
					parsedMessage.payload,
				);
				const authHint =
					resolvedAuth.source === "none"
						? ` Provide --token/--password or set ${TERMINAL_PROBE_GATEWAY_TOKEN_ENV}/${TERMINAL_PROBE_GATEWAY_PASSWORD_ENV}.`
						: "";
				finish(
					1,
					`[terminal-probe] connect handshake failed: ${reason}.${authHint}`,
				);
				return;
			}

			if (options.sessionId) {
				subscribeToSession(options.sessionId);
			} else {
				if (startupTimer) {
					clearTimeout(startupTimer);
					startupTimer = null;
				}
				console.log(
					"[terminal-probe] connected (auto mode). Start a prompt in UI; probe will auto-subscribe.",
				);
			}
			return;
		}

		if (parsedMessage.type === "ack") {
			const payload = asRecord(parsedMessage.payload);
			const action = asString(payload?.action);
			const sessionId = asString(payload?.sessionId);
			if (action === "session_subscribe" && sessionId) {
				pendingSubscriptions.delete(sessionId);
				subscribedSessions.add(sessionId);
				hasSessionSubscription = true;
				if (startupTimer) {
					clearTimeout(startupTimer);
					startupTimer = null;
				}
				console.log(
					`[terminal-probe] subscribed session=${sessionId} (waiting for terminal events)`,
				);
			}
			return;
		}

		if (parsedMessage.type !== "event:agent") return;
		if (!parsedMessage.id) return;

		const payload = asRecord(parsedMessage.payload);
		if (!payload) return;

		const payloadType = asString(payload.type);
		const payloadSessionId = asString(payload.sessionId);

		if (!options.sessionId) {
			if (
				payloadType === "session-message" &&
				asString(payload.role) === "user" &&
				payloadSessionId
			) {
				subscribeToSession(payloadSessionId);
			}
		}

		if (options.requestId && parsedMessage.id !== options.requestId) return;
		if (options.sessionId && payloadSessionId !== options.sessionId) return;
		if (
			!options.sessionId &&
			payloadSessionId &&
			!subscribedSessions.has(payloadSessionId)
		) {
			return;
		}

		if (!shouldReportTerminalProbeEvent(payloadType, options.verbose)) {
			return;
		}

		const probeEvent = buildProbeEvent({
			payloadType,
			requestId: parsedMessage.id,
			payload,
		});

		console.log(formatTerminalProbeEvent(probeEvent));
	});
}

void main();
