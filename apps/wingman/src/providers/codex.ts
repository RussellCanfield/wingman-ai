import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { createLogger } from "../logger.js";

const CODEX_HOME_ENV = "CODEX_HOME";
const CODEX_AUTH_FILE = "auth.json";
const CODEX_REFRESH_TOKEN_URL_OVERRIDE_ENV = "CODEX_REFRESH_TOKEN_URL_OVERRIDE";
const DEFAULT_CODEX_REFRESH_TOKEN_URL = "https://auth.openai.com/oauth/token";
const TOKEN_REFRESH_BUFFER_MS = 5 * 60 * 1000;
const DEFAULT_CODEX_INSTRUCTIONS =
	"You are Wingman, a coding assistant. Follow the user's request exactly and keep tool usage focused.";
const logger = createLogger();

type FetchLike = (
	input: Parameters<typeof fetch>[0],
	init?: Parameters<typeof fetch>[1],
) => ReturnType<typeof fetch>;

export interface CodexAuthState {
	accessToken?: string;
	refreshToken?: string;
	idToken?: string;
	accountId?: string;
	authPath: string;
}

export interface CodexFetchOptions {
	baseFetch?: FetchLike;
	fallbackToken?: string;
	fallbackAccountId?: string;
}

export function getCodexAuthPath(): string {
	const codexHome = process.env[CODEX_HOME_ENV]?.trim();
	if (codexHome) {
		return join(codexHome, CODEX_AUTH_FILE);
	}

	return join(homedir(), ".codex", CODEX_AUTH_FILE);
}

export function resolveCodexAuthFromFile(): CodexAuthState {
	const authPath = getCodexAuthPath();
	const root = readCodexAuthRoot(authPath);
	if (!root) {
		return { authPath };
	}

	const tokens =
		root.tokens && typeof root.tokens === "object"
			? (root.tokens as Record<string, unknown>)
			: undefined;

	const accessToken = firstNonEmptyString([
		tokens?.access_token,
		root.access_token,
	]);
	const refreshToken = firstNonEmptyString([
		tokens?.refresh_token,
		root.refresh_token,
	]);
	const idToken = firstNonEmptyString([tokens?.id_token, root.id_token]);
	const accountId = firstNonEmptyString([
		tokens?.account_id,
		root.account_id,
		extractAccountIdFromIdToken(idToken),
	]);

	return {
		accessToken,
		refreshToken,
		idToken,
		accountId,
		authPath,
	};
}

export function createCodexFetch(options: CodexFetchOptions = {}): FetchLike {
	const baseFetch: FetchLike =
		options.baseFetch || globalThis.fetch.bind(globalThis);

	return async (input, init) => {
		let codexAuth = await maybeRefreshCodexAuth({
			authState: resolveCodexAuthFromFile(),
			baseFetch,
		});
		let accessToken = codexAuth.accessToken || options.fallbackToken;
		let accountId = codexAuth.accountId || options.fallbackAccountId;

		if (!accessToken) {
			throw new Error(
				"Codex credentials missing. Run `codex login` or set CODEX_ACCESS_TOKEN.",
			);
		}

		const body = withCodexRequestDefaults(init?.body);
		let response = await dispatchCodexRequest({
			input,
			init,
			baseFetch,
			accessToken,
			accountId,
			body,
		});
		if (
			(response.status === 401 || response.status === 403) &&
			canRetryCodexRequest(body) &&
			codexAuth.refreshToken
		) {
			const refreshed = await maybeRefreshCodexAuth({
				authState: codexAuth,
				baseFetch,
				force: true,
			});
			const refreshedAccessToken =
				refreshed.accessToken || options.fallbackToken;
			const refreshedAccountId =
				refreshed.accountId || options.fallbackAccountId;
			if (refreshedAccessToken && refreshedAccessToken !== accessToken) {
				codexAuth = refreshed;
				accessToken = refreshedAccessToken;
				accountId = refreshedAccountId;
				response = await dispatchCodexRequest({
					input,
					init,
					baseFetch,
					accessToken,
					accountId,
					body,
				});
			}
		}

		if (!response.ok) {
			let responseBody = "";
			try {
				responseBody = await response.clone().text();
			} catch {}
			const preview = responseBody.trim().slice(0, 1200);
			logger.warn(
				`Codex request failed (${response.status} ${response.statusText || ""})`,
				{
					url:
						typeof input === "string"
							? input
							: input instanceof URL
								? input.toString()
								: input.url,
					bodyPresent: preview.length > 0,
					bodyPreview: preview || null,
				},
			);
		}
		return response;
	};
}

async function dispatchCodexRequest(input: {
	input: Parameters<typeof fetch>[0];
	init?: Parameters<typeof fetch>[1];
	baseFetch: FetchLike;
	accessToken: string;
	accountId?: string;
	body: RequestInit["body"];
}): Promise<Response> {
	const headers = new Headers(input.init?.headers || {});
	headers.delete("authorization");
	headers.delete("x-api-key");
	headers.set("Authorization", `Bearer ${input.accessToken}`);
	if (input.accountId) {
		headers.set("ChatGPT-Account-ID", input.accountId);
	}

	return input.baseFetch(input.input, {
		...input.init,
		headers,
		body: input.body,
	});
}

function canRetryCodexRequest(body: RequestInit["body"]): boolean {
	return (
		body === undefined ||
		body === null ||
		typeof body === "string" ||
		body instanceof URLSearchParams
	);
}

async function maybeRefreshCodexAuth(input: {
	authState: CodexAuthState;
	baseFetch: FetchLike;
	force?: boolean;
}): Promise<CodexAuthState> {
	const { authState, baseFetch, force = false } = input;
	if (!authState.refreshToken) {
		return authState;
	}

	const shouldRefresh =
		force ||
		!authState.accessToken ||
		isTokenExpiredOrExpiring(authState.accessToken);
	if (!shouldRefresh) {
		return authState;
	}

	try {
		const refreshed = await refreshCodexAuthToken(authState, baseFetch);
		if (refreshed) {
			return refreshed;
		}
	} catch (error) {
		logger.warn("Failed to refresh Codex token", {
			error: error instanceof Error ? error.message : String(error),
		});
	}

	return authState;
}

async function refreshCodexAuthToken(
	authState: CodexAuthState,
	baseFetch: FetchLike,
): Promise<CodexAuthState | undefined> {
	const refreshToken = authState.refreshToken;
	if (!refreshToken) {
		return undefined;
	}

	const clientId = extractClientIdForRefresh(authState);
	const tokenUrl = resolveCodexRefreshTokenUrl();
	const form = new URLSearchParams({
		grant_type: "refresh_token",
		refresh_token: refreshToken,
	});
	if (clientId) {
		form.set("client_id", clientId);
	}

	const response = await baseFetch(tokenUrl, {
		method: "POST",
		headers: {
			Accept: "application/json",
			"Content-Type": "application/x-www-form-urlencoded",
		},
		body: form.toString(),
	});
	if (!response.ok) {
		const preview = await readResponsePreview(response);
		logger.warn("Codex token refresh failed", {
			status: response.status,
			statusText: response.statusText || null,
			bodyPreview: preview || null,
		});
		return undefined;
	}

	const payload = (await response.json()) as Record<string, unknown>;
	const accessToken = firstNonEmptyString([payload.access_token]);
	if (!accessToken) {
		logger.warn("Codex token refresh failed: missing access_token");
		return undefined;
	}

	const idToken = firstNonEmptyString([payload.id_token, authState.idToken]);
	const refreshed = {
		accessToken,
		refreshToken: firstNonEmptyString([
			payload.refresh_token,
			authState.refreshToken,
		]),
		idToken,
		accountId: firstNonEmptyString([
			extractAccountIdFromIdToken(idToken),
			authState.accountId,
		]),
	};

	persistCodexAuthUpdate(authState.authPath, refreshed);
	return resolveCodexAuthFromFile();
}

async function readResponsePreview(response: Response): Promise<string> {
	try {
		const text = await response.text();
		return text.trim().slice(0, 1200);
	} catch {
		return "";
	}
}

function persistCodexAuthUpdate(
	authPath: string,
	updated: {
		accessToken: string;
		refreshToken?: string;
		idToken?: string;
		accountId?: string;
	},
): void {
	const root = readCodexAuthRoot(authPath) || {};
	const existingTokens =
		root.tokens &&
		typeof root.tokens === "object" &&
		!Array.isArray(root.tokens)
			? (root.tokens as Record<string, unknown>)
			: {};

	const tokens: Record<string, unknown> = {
		...existingTokens,
		access_token: updated.accessToken,
	};
	if (updated.refreshToken) {
		tokens.refresh_token = updated.refreshToken;
	}
	if (updated.idToken) {
		tokens.id_token = updated.idToken;
	}
	if (updated.accountId) {
		tokens.account_id = updated.accountId;
	}

	root.tokens = tokens;
	root.last_refresh = new Date().toISOString();
	writeFileSync(authPath, `${JSON.stringify(root, null, 2)}\n`, "utf-8");
}

function readCodexAuthRoot(
	authPath: string,
): Record<string, unknown> | undefined {
	if (!existsSync(authPath)) {
		return undefined;
	}

	try {
		const parsed = JSON.parse(readFileSync(authPath, "utf-8")) as unknown;
		if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
			return undefined;
		}
		return parsed as Record<string, unknown>;
	} catch {
		return undefined;
	}
}

function resolveCodexRefreshTokenUrl(): string {
	const override = process.env[CODEX_REFRESH_TOKEN_URL_OVERRIDE_ENV];
	if (override?.trim()) {
		return override.trim();
	}
	return DEFAULT_CODEX_REFRESH_TOKEN_URL;
}

function extractClientIdForRefresh(
	authState: CodexAuthState,
): string | undefined {
	const accessTokenClaims = parseJwtPayload(authState.accessToken);
	const accessTokenClientId =
		accessTokenClaims && typeof accessTokenClaims.client_id === "string"
			? accessTokenClaims.client_id
			: undefined;
	if (accessTokenClientId?.trim()) {
		return accessTokenClientId.trim();
	}

	const idTokenClaims = parseJwtPayload(authState.idToken);
	if (!idTokenClaims) {
		return undefined;
	}

	const aud = idTokenClaims.aud;
	if (typeof aud === "string" && aud.trim()) {
		return aud.trim();
	}
	if (Array.isArray(aud)) {
		for (const value of aud) {
			if (typeof value === "string" && value.trim()) {
				return value.trim();
			}
		}
	}

	return undefined;
}

function isTokenExpiredOrExpiring(token: string): boolean {
	const expiryMs = extractTokenExpiryMs(token);
	if (!expiryMs) {
		return false;
	}
	return expiryMs <= Date.now() + TOKEN_REFRESH_BUFFER_MS;
}

function extractTokenExpiryMs(token: string): number | undefined {
	const payload = parseJwtPayload(token);
	if (!payload || typeof payload.exp !== "number") {
		return undefined;
	}
	return payload.exp * 1000;
}

function extractAccountIdFromIdToken(
	idToken: string | undefined,
): string | undefined {
	const payload = parseJwtPayload(idToken);
	if (!payload) {
		return undefined;
	}

	const nested = payload["https://api.openai.com/auth"];
	if (nested && typeof nested === "object" && !Array.isArray(nested)) {
		const accountId = (nested as Record<string, unknown>).chatgpt_account_id;
		if (typeof accountId === "string" && accountId.trim()) {
			return accountId.trim();
		}
	}

	const direct = payload.chatgpt_account_id;
	if (typeof direct === "string" && direct.trim()) {
		return direct.trim();
	}

	return undefined;
}

function parseJwtPayload(
	token: string | undefined,
): Record<string, unknown> | undefined {
	if (!token) {
		return undefined;
	}
	const parts = token.split(".");
	if (parts.length !== 3) {
		return undefined;
	}

	try {
		const payload = parts[1];
		const normalized = payload + "=".repeat((4 - (payload.length % 4)) % 4);
		const decoded = Buffer.from(normalized, "base64url").toString("utf-8");
		const parsed = JSON.parse(decoded) as unknown;
		if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
			return undefined;
		}
		return parsed as Record<string, unknown>;
	} catch {
		return undefined;
	}
}

function withCodexRequestDefaults(
	body: RequestInit["body"],
): RequestInit["body"] {
	if (typeof body !== "string" || !body.trim()) {
		return body;
	}

	try {
		const parsed = JSON.parse(body) as unknown;
		if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
			return body;
		}

		const root = stripUnsupportedCodexParams(parsed as Record<string, unknown>);
		const instructions =
			typeof root.instructions === "string" && root.instructions.trim()
				? root.instructions.trim()
				: extractInstructionsFromInput(root.input) ||
					DEFAULT_CODEX_INSTRUCTIONS;

		// Codex responses endpoint requires store=false.
		return JSON.stringify({ ...root, store: false, instructions });
	} catch {
		return body;
	}
}

function stripUnsupportedCodexParams(
	payload: Record<string, unknown>,
): Record<string, unknown> {
	const next = { ...payload };
	delete next.temperature;
	return next;
}

function extractInstructionsFromInput(input: unknown): string | undefined {
	if (!Array.isArray(input)) {
		return undefined;
	}

	for (const item of input) {
		if (!item || typeof item !== "object" || Array.isArray(item)) {
			continue;
		}
		const message = item as Record<string, unknown>;
		const role = typeof message.role === "string" ? message.role : "";
		if (role !== "system" && role !== "developer") {
			continue;
		}
		const text = extractTextContent(message.content);
		if (text) {
			return text;
		}
	}

	return undefined;
}

function extractTextContent(content: unknown): string | undefined {
	if (typeof content === "string" && content.trim()) {
		return content.trim();
	}
	if (!Array.isArray(content)) {
		return undefined;
	}

	for (const part of content) {
		if (!part || typeof part !== "object" || Array.isArray(part)) {
			continue;
		}
		const block = part as Record<string, unknown>;
		const text =
			typeof block.text === "string"
				? block.text
				: typeof block.content === "string"
					? block.content
					: undefined;
		if (!text || !text.trim()) {
			continue;
		}
		const type = typeof block.type === "string" ? block.type : "";
		if (!type || type.includes("text")) {
			return text.trim();
		}
	}

	return undefined;
}

function firstNonEmptyString(values: unknown[]): string | undefined {
	for (const value of values) {
		if (typeof value === "string" && value.trim()) {
			return value.trim();
		}
	}
	return undefined;
}
