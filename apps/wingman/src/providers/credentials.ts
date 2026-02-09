import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { resolveCodexAuthFromFile } from "./codex.js";
import { getProviderSpec, type ProviderName } from "./registry.js";

export interface ProviderCredentials {
	apiKey?: string;
	accessToken?: string;
	refreshToken?: string;
	expiresAt?: string;
	tokenType?: string;
}

export interface ProviderCredentialsFile {
	version: number;
	updatedAt: string;
	providers: Record<string, ProviderCredentials>;
}

export type ProviderAuthSource = "env" | "credentials" | "missing";

const CREDENTIALS_VERSION = 1;
const CREDENTIALS_DIR = join(homedir(), ".wingman");
const CREDENTIALS_PATH = join(CREDENTIALS_DIR, "credentials.json");

export function getCredentialsPath(): string {
	return CREDENTIALS_PATH;
}

function emptyCredentials(): ProviderCredentialsFile {
	return {
		version: CREDENTIALS_VERSION,
		updatedAt: new Date().toISOString(),
		providers: {},
	};
}

export function readCredentialsFile(): ProviderCredentialsFile {
	if (!existsSync(CREDENTIALS_PATH)) {
		return emptyCredentials();
	}

	try {
		const raw = readFileSync(CREDENTIALS_PATH, "utf-8");
		const parsed = JSON.parse(raw);

		const providers =
			parsed && typeof parsed.providers === "object" && parsed.providers
				? parsed.providers
				: {};

		return {
			version:
				typeof parsed?.version === "number"
					? parsed.version
					: CREDENTIALS_VERSION,
			updatedAt:
				typeof parsed?.updatedAt === "string"
					? parsed.updatedAt
					: new Date().toISOString(),
			providers,
		};
	} catch {
		return emptyCredentials();
	}
}

export function writeCredentialsFile(data: ProviderCredentialsFile): void {
	mkdirSync(CREDENTIALS_DIR, { recursive: true });
	writeFileSync(CREDENTIALS_PATH, JSON.stringify(data, null, 2));
}

export function getProviderCredentials(
	provider: ProviderName,
): ProviderCredentials | undefined {
	const file = readCredentialsFile();
	return file.providers[provider];
}

export function setProviderCredentials(
	provider: ProviderName,
	credentials: ProviderCredentials,
): void {
	const file = readCredentialsFile();
	file.providers[provider] = {
		...(file.providers[provider] || {}),
		...credentials,
	};
	file.updatedAt = new Date().toISOString();
	writeCredentialsFile(file);
}

export function deleteProviderCredentials(provider: ProviderName): boolean {
	const file = readCredentialsFile();
	if (!file.providers[provider]) {
		return false;
	}

	delete file.providers[provider];
	file.updatedAt = new Date().toISOString();
	writeCredentialsFile(file);
	return true;
}

export function saveProviderToken(
	providerName: string,
	token: string,
): ProviderCredentials {
	const provider = getProviderSpec(providerName);
	if (!provider) {
		throw new Error(`Unknown provider: "${providerName}"`);
	}

	const normalized = token.trim();
	if (!normalized) {
		throw new Error("Token is required");
	}

	const existing = getProviderCredentials(provider.name) || {};
	const updated = { ...existing };

	if (provider.type === "oauth") {
		updated.accessToken = normalized;
		updated.tokenType = "bearer";
	} else {
		updated.apiKey = normalized;
	}

	setProviderCredentials(provider.name, updated);
	return updated;
}

export function resolveProviderToken(providerName: string): {
	token?: string;
	source: ProviderAuthSource;
	envVar?: string;
} {
	const provider = getProviderSpec(providerName);
	if (!provider) {
		return { source: "missing" };
	}

	for (const envVar of provider.envVars) {
		const value = process.env[envVar];
		if (value && value.trim()) {
			return { token: value.trim(), source: "env", envVar };
		}
	}

	// Codex subscription login state should take precedence over any previously
	// stored Wingman token so stale manual tokens do not shadow valid Codex auth.
	if (provider.name === "codex") {
		const codexAuth = resolveCodexAuthFromFile();
		if (codexAuth.accessToken) {
			return { token: codexAuth.accessToken, source: "credentials" };
		}
	}

	const credentials = getProviderCredentials(provider.name);
	const token =
		credentials?.accessToken ??
		credentials?.apiKey ??
		credentials?.refreshToken;
	if (token && token.trim()) {
		return { token: token.trim(), source: "credentials" };
	}

	return { source: "missing" };
}
