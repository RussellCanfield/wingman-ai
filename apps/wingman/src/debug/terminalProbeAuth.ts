import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

export const TERMINAL_PROBE_GATEWAY_TOKEN_ENV = "WINGMAN_GATEWAY_TOKEN";
export const TERMINAL_PROBE_GATEWAY_PASSWORD_ENV = "WINGMAN_GATEWAY_PASSWORD";

type TerminalProbeAuthSource = "cli" | "env" | "config" | "none";

export type TerminalProbeAuth = {
	token?: string;
	password?: string;
	source: TerminalProbeAuthSource;
	configPath?: string;
};

type ResolveTerminalProbeAuthOptions = {
	cliToken?: string;
	cliPassword?: string;
	env?: Record<string, string | undefined>;
	cwd?: string;
	homeDir?: string;
	configFileCandidates?: string[];
};

function normalizeSecret(raw: unknown): string | undefined {
	if (typeof raw !== "string") return undefined;
	const value = raw.trim();
	return value.length > 0 ? value : undefined;
}

function parseGatewayAuthConfig(
	rawConfig: unknown,
): { token?: string; password?: string } | null {
	if (!rawConfig || typeof rawConfig !== "object" || Array.isArray(rawConfig)) {
		return null;
	}
	const config = rawConfig as Record<string, unknown>;
	const gateway = config.gateway;
	if (!gateway || typeof gateway !== "object" || Array.isArray(gateway)) {
		return null;
	}
	const auth = (gateway as Record<string, unknown>).auth;
	if (!auth || typeof auth !== "object" || Array.isArray(auth)) {
		return null;
	}
	const authConfig = auth as Record<string, unknown>;
	const mode =
		typeof authConfig.mode === "string" ? authConfig.mode.toLowerCase() : "";
	const token = normalizeSecret(authConfig.token);
	const password = normalizeSecret(authConfig.password);

	if (mode === "token" && token) {
		return { token };
	}
	if (mode === "password" && password) {
		return { password };
	}
	if (!mode && (token || password)) {
		return { token, password };
	}
	return null;
}

function unique(values: string[]): string[] {
	return Array.from(new Set(values));
}

function resolveConfigCandidates(
	options: ResolveTerminalProbeAuthOptions,
): string[] {
	if (options.configFileCandidates?.length) {
		return unique(options.configFileCandidates);
	}
	const cwd = options.cwd ?? process.cwd();
	const homeDir = options.homeDir ?? homedir();
	return unique([
		join(cwd, ".wingman", "wingman.config.json"),
		join(homeDir, ".wingman", "wingman.config.json"),
	]);
}

function resolveAuthFromConfig(
	options: ResolveTerminalProbeAuthOptions,
): { token?: string; password?: string; configPath?: string } | null {
	for (const configPath of resolveConfigCandidates(options)) {
		if (!existsSync(configPath)) continue;
		try {
			const raw = readFileSync(configPath, "utf-8");
			const parsed = JSON.parse(raw);
			const auth = parseGatewayAuthConfig(parsed);
			if (auth) {
				return {
					...auth,
					configPath,
				};
			}
		} catch {
			// Ignore invalid config files and continue checking candidates.
		}
	}
	return null;
}

export function resolveTerminalProbeAuth(
	options: ResolveTerminalProbeAuthOptions = {},
): TerminalProbeAuth {
	const cliToken = normalizeSecret(options.cliToken);
	const cliPassword = normalizeSecret(options.cliPassword);
	if (cliToken || cliPassword) {
		return {
			token: cliToken,
			password: cliPassword,
			source: "cli",
		};
	}

	const env = options.env ?? process.env;
	const envToken = normalizeSecret(env[TERMINAL_PROBE_GATEWAY_TOKEN_ENV]);
	const envPassword = normalizeSecret(env[TERMINAL_PROBE_GATEWAY_PASSWORD_ENV]);
	if (envToken || envPassword) {
		return {
			token: envToken,
			password: envPassword,
			source: "env",
		};
	}

	const fromConfig = resolveAuthFromConfig(options);
	if (fromConfig?.token || fromConfig?.password) {
		return {
			token: fromConfig.token,
			password: fromConfig.password,
			source: "config",
			configPath: fromConfig.configPath,
		};
	}

	return { source: "none" };
}

export function formatTerminalProbeHandshakeFailure(payload: unknown): string {
	if (typeof payload === "string") {
		const value = payload.trim();
		return value.length > 0 ? value : "unknown";
	}
	if (payload === undefined || payload === null) {
		return "unknown";
	}
	try {
		return JSON.stringify(payload);
	} catch {
		return "unknown";
	}
}
