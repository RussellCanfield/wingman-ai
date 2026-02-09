import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { createLogger } from "../logger.js";

const CODEX_HOME_ENV = "CODEX_HOME";
const CODEX_AUTH_FILE = "auth.json";
const DEFAULT_CODEX_INSTRUCTIONS =
	"You are Wingman, a coding assistant. Follow the user's request exactly and keep tool usage focused.";
const logger = createLogger();

type FetchLike = (
	input: Parameters<typeof fetch>[0],
	init?: Parameters<typeof fetch>[1],
) => ReturnType<typeof fetch>;

export interface CodexAuthState {
	accessToken?: string;
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
	if (!existsSync(authPath)) {
		return { authPath };
	}

	try {
		const parsed = JSON.parse(readFileSync(authPath, "utf-8")) as unknown;
		if (!parsed || typeof parsed !== "object") {
			return { authPath };
		}

		const root = parsed as Record<string, unknown>;
		const tokens =
			root.tokens && typeof root.tokens === "object"
				? (root.tokens as Record<string, unknown>)
				: undefined;

		const accessToken = firstNonEmptyString([
			tokens?.access_token,
			root.access_token,
		]);
		const accountId = firstNonEmptyString([
			tokens?.account_id,
			root.account_id,
		]);

		return {
			accessToken,
			accountId,
			authPath,
		};
	} catch {
		return { authPath };
	}
}

export function createCodexFetch(options: CodexFetchOptions = {}): FetchLike {
	const baseFetch: FetchLike =
		options.baseFetch || globalThis.fetch.bind(globalThis);

	return async (input, init) => {
		const codexAuth = resolveCodexAuthFromFile();
		const accessToken = codexAuth.accessToken || options.fallbackToken;
		const accountId = codexAuth.accountId || options.fallbackAccountId;

		if (!accessToken) {
			throw new Error(
				"Codex credentials missing. Run `codex login` or set CODEX_ACCESS_TOKEN.",
			);
		}

		const headers = new Headers(init?.headers || {});
		headers.delete("authorization");
		headers.delete("x-api-key");
		headers.set("Authorization", `Bearer ${accessToken}`);
		if (accountId) {
			headers.set("ChatGPT-Account-ID", accountId);
		}

		const body = withCodexRequestDefaults(init?.body);
		const response = await baseFetch(input, { ...init, headers, body });
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

function withCodexRequestDefaults(body: RequestInit["body"]): RequestInit["body"] {
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
				: extractInstructionsFromInput(root.input) || DEFAULT_CODEX_INSTRUCTIONS;

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
