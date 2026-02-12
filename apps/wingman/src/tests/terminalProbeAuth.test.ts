import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
	formatTerminalProbeHandshakeFailure,
	resolveTerminalProbeAuth,
	TERMINAL_PROBE_GATEWAY_PASSWORD_ENV,
	TERMINAL_PROBE_GATEWAY_TOKEN_ENV,
} from "../debug/terminalProbeAuth.js";

function writeConfig(
	configDir: string,
	config: Record<string, unknown>,
): string {
	const wingmanDir = join(configDir, ".wingman");
	mkdirSync(wingmanDir, { recursive: true });
	const configPath = join(wingmanDir, "wingman.config.json");
	writeFileSync(configPath, JSON.stringify(config), "utf-8");
	return configPath;
}

describe("resolveTerminalProbeAuth", () => {
	it("prefers CLI auth when provided", () => {
		const auth = resolveTerminalProbeAuth({
			cliToken: "cli-token",
			cliPassword: "cli-pass",
			env: {
				[TERMINAL_PROBE_GATEWAY_TOKEN_ENV]: "env-token",
			},
		});

		expect(auth.source).toBe("cli");
		expect(auth.token).toBe("cli-token");
		expect(auth.password).toBe("cli-pass");
	});

	it("falls back to env auth when CLI auth is missing", () => {
		const auth = resolveTerminalProbeAuth({
			env: {
				[TERMINAL_PROBE_GATEWAY_TOKEN_ENV]: "env-token",
				[TERMINAL_PROBE_GATEWAY_PASSWORD_ENV]: "env-pass",
			},
		});

		expect(auth.source).toBe("env");
		expect(auth.token).toBe("env-token");
		expect(auth.password).toBe("env-pass");
	});

	it("loads token auth from config when env and CLI are missing", () => {
		const dir = mkdtempSync(join(tmpdir(), "terminal-probe-auth-"));
		const configPath = writeConfig(dir, {
			gateway: {
				auth: {
					mode: "token",
					token: "config-token",
				},
			},
		});

		const auth = resolveTerminalProbeAuth({
			env: {},
			cwd: dir,
			homeDir: join(tmpdir(), "non-existent-home"),
		});

		expect(auth.source).toBe("config");
		expect(auth.token).toBe("config-token");
		expect(auth.configPath).toBe(configPath);
	});

	it("returns none when no auth material is available", () => {
		const auth = resolveTerminalProbeAuth({
			env: {},
			cwd: join(tmpdir(), "terminal-probe-auth-empty"),
			homeDir: join(tmpdir(), "terminal-probe-auth-empty-home"),
		});

		expect(auth.source).toBe("none");
		expect(auth.token).toBeUndefined();
		expect(auth.password).toBeUndefined();
	});
});

describe("formatTerminalProbeHandshakeFailure", () => {
	it("formats string payloads directly", () => {
		expect(formatTerminalProbeHandshakeFailure("authentication failed")).toBe(
			"authentication failed",
		);
	});

	it("formats structured payloads as JSON", () => {
		expect(
			formatTerminalProbeHandshakeFailure({
				code: "AUTH_FAILED",
				message: "bad token",
			}),
		).toContain('"code":"AUTH_FAILED"');
	});
});
