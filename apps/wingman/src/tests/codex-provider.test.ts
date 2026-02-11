import {
	existsSync,
	mkdirSync,
	mkdtempSync,
	readFileSync,
	rmSync,
	writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
	createCodexFetch,
	getCodexAuthPath,
	resolveCodexAuthFromFile,
} from "@/providers/codex.js";

describe("codex provider", () => {
	let codexHome: string;
	const originalCodexHome = process.env.CODEX_HOME;

	beforeEach(() => {
		codexHome = mkdtempSync(join(tmpdir(), "wingman-codex-"));
		process.env.CODEX_HOME = codexHome;
		delete process.env.CODEX_ACCESS_TOKEN;
		delete process.env.CHATGPT_ACCESS_TOKEN;
	});

	afterEach(() => {
		if (originalCodexHome === undefined) {
			delete process.env.CODEX_HOME;
		} else {
			process.env.CODEX_HOME = originalCodexHome;
		}

		if (existsSync(codexHome)) {
			rmSync(codexHome, { recursive: true, force: true });
		}
	});

	it("reads access token and account id from codex auth file", () => {
		writeCodexAuth({
			tokens: {
				access_token: "codex-access-token",
				account_id: "acct_123",
			},
		});

		const resolved = resolveCodexAuthFromFile();

		expect(resolved.accessToken).toBe("codex-access-token");
		expect(resolved.accountId).toBe("acct_123");
		expect(resolved.authPath).toBe(join(codexHome, "auth.json"));
	});

	it("applies codex auth headers and forces store=false", async () => {
		writeCodexAuth({
			tokens: {
				access_token: "file-token",
				account_id: "acct_file",
			},
		});

		const baseFetch = vi.fn(
			async (
				_input: Parameters<typeof fetch>[0],
				_init?: Parameters<typeof fetch>[1],
			) => new Response("{}", { status: 200 }),
		);
		const codexFetch = createCodexFetch({ baseFetch });

		await codexFetch("https://chatgpt.com/backend-api/codex/responses", {
			method: "POST",
			headers: {
				"x-api-key": "placeholder",
			},
			body: JSON.stringify({
				model: "codex-mini-latest",
				input: "hello",
				temperature: 1,
			}),
		});

		expect(baseFetch).toHaveBeenCalledTimes(1);
		const requestInit = baseFetch.mock.calls[0]?.[1];
		expect(requestInit).toBeDefined();
		const headers = new Headers(requestInit?.headers);
		const payload = JSON.parse(String(requestInit?.body));

		expect(headers.get("authorization")).toBe("Bearer file-token");
		expect(headers.get("chatgpt-account-id")).toBe("acct_file");
		expect(headers.get("x-api-key")).toBeNull();
		expect(payload.store).toBe(false);
		expect(payload.temperature).toBeUndefined();
		expect(typeof payload.instructions).toBe("string");
		expect(payload.instructions.length).toBeGreaterThan(0);
	});

	it("derives instructions from system/developer input when missing", async () => {
		writeCodexAuth({
			tokens: {
				access_token: "file-token",
			},
		});

		const baseFetch = vi.fn(
			async (
				_input: Parameters<typeof fetch>[0],
				_init?: Parameters<typeof fetch>[1],
			) => new Response("{}", { status: 200 }),
		);
		const codexFetch = createCodexFetch({ baseFetch });

		await codexFetch("https://chatgpt.com/backend-api/codex/responses", {
			method: "POST",
			body: JSON.stringify({
				model: "gpt-5.3-codex",
				input: [
					{
						role: "developer",
						content: [{ type: "input_text", text: "Always run tests first." }],
					},
					{
						role: "user",
						content: [{ type: "input_text", text: "Fix the bug." }],
					},
				],
			}),
		});

		const requestInit = baseFetch.mock.calls[0]?.[1];
		const payload = JSON.parse(String(requestInit?.body));
		expect(payload.instructions).toBe("Always run tests first.");
	});

	it("preserves explicit instructions when provided", async () => {
		writeCodexAuth({
			tokens: {
				access_token: "file-token",
			},
		});

		const baseFetch = vi.fn(
			async (
				_input: Parameters<typeof fetch>[0],
				_init?: Parameters<typeof fetch>[1],
			) => new Response("{}", { status: 200 }),
		);
		const codexFetch = createCodexFetch({ baseFetch });

		await codexFetch("https://chatgpt.com/backend-api/codex/responses", {
			method: "POST",
			body: JSON.stringify({
				model: "gpt-5.3-codex",
				instructions: "Use concise answers.",
				input: "hello",
			}),
		});

		const requestInit = baseFetch.mock.calls[0]?.[1];
		const payload = JSON.parse(String(requestInit?.body));
		expect(payload.instructions).toBe("Use concise answers.");
	});

	it("overrides explicit store values to false when provided", async () => {
		writeCodexAuth({
			tokens: {
				access_token: "file-token",
			},
		});

		const baseFetch = vi.fn(
			async (
				_input: Parameters<typeof fetch>[0],
				_init?: Parameters<typeof fetch>[1],
			) => new Response("{}", { status: 200 }),
		);
		const codexFetch = createCodexFetch({ baseFetch });

		await codexFetch("https://chatgpt.com/backend-api/codex/responses", {
			method: "POST",
			body: JSON.stringify({
				model: "gpt-5.3-codex",
				store: true,
				input: "hello",
			}),
		});

		const requestInit = baseFetch.mock.calls[0]?.[1];
		const payload = JSON.parse(String(requestInit?.body));
		expect(payload.store).toBe(false);
	});

	it("refreshes tokens when the codex access token is expiring", async () => {
		const expiringAccessToken = createJwt({
			exp: Math.floor((Date.now() + 30_000) / 1000),
			client_id: "app_client_123",
		});
		const refreshedAccessToken = createJwt({
			exp: Math.floor((Date.now() + 24 * 60 * 60 * 1000) / 1000),
			client_id: "app_client_123",
		});
		const staleIdToken = createJwt({
			aud: ["app_client_123"],
			"https://api.openai.com/auth": {
				chatgpt_account_id: "acct_old",
			},
		});
		const refreshedIdToken = createJwt({
			aud: ["app_client_123"],
			"https://api.openai.com/auth": {
				chatgpt_account_id: "acct_refreshed",
			},
		});

		writeCodexAuth({
			tokens: {
				access_token: expiringAccessToken,
				refresh_token: "refresh-old",
				id_token: staleIdToken,
				account_id: "acct_old",
			},
		});

		const baseFetch = vi.fn(
			async (
				input: Parameters<typeof fetch>[0],
				init?: Parameters<typeof fetch>[1],
			) => {
				const url =
					typeof input === "string"
						? input
						: input instanceof URL
							? input.toString()
							: input.url;
				if (url === "https://auth.openai.com/oauth/token") {
					const params = new URLSearchParams(String(init?.body ?? ""));
					expect(params.get("grant_type")).toBe("refresh_token");
					expect(params.get("refresh_token")).toBe("refresh-old");
					expect(params.get("client_id")).toBe("app_client_123");

					return new Response(
						JSON.stringify({
							access_token: refreshedAccessToken,
							refresh_token: "refresh-new",
							id_token: refreshedIdToken,
							token_type: "bearer",
							expires_in: 864000,
						}),
						{
							status: 200,
							headers: { "content-type": "application/json" },
						},
					);
				}

				expect(url).toBe("https://chatgpt.com/backend-api/codex/responses");
				const headers = new Headers(init?.headers);
				expect(headers.get("authorization")).toBe(
					`Bearer ${refreshedAccessToken}`,
				);
				expect(headers.get("chatgpt-account-id")).toBe("acct_refreshed");
				return new Response("{}", { status: 200 });
			},
		);

		const codexFetch = createCodexFetch({ baseFetch });
		await codexFetch("https://chatgpt.com/backend-api/codex/responses", {
			method: "POST",
			body: JSON.stringify({ model: "codex-mini-latest", input: "hello" }),
		});

		expect(baseFetch).toHaveBeenCalledTimes(2);
		const persisted = JSON.parse(readFileSync(getCodexAuthPath(), "utf-8")) as {
			tokens?: Record<string, string>;
			last_refresh?: string;
		};
		expect(persisted.tokens?.access_token).toBe(refreshedAccessToken);
		expect(persisted.tokens?.refresh_token).toBe("refresh-new");
		expect(persisted.tokens?.id_token).toBe(refreshedIdToken);
		expect(persisted.tokens?.account_id).toBe("acct_refreshed");
		expect(typeof persisted.last_refresh).toBe("string");
	});

	it("retries once after auth failure by refreshing codex token", async () => {
		const initialAccessToken = createJwt({
			exp: Math.floor((Date.now() + 24 * 60 * 60 * 1000) / 1000),
			client_id: "app_client_retry",
		});
		const refreshedAccessToken = createJwt({
			exp: Math.floor((Date.now() + 48 * 60 * 60 * 1000) / 1000),
			client_id: "app_client_retry",
		});
		const idToken = createJwt({
			aud: ["app_client_retry"],
			"https://api.openai.com/auth": {
				chatgpt_account_id: "acct_retry",
			},
		});
		const refreshedIdToken = createJwt({
			aud: ["app_client_retry"],
			"https://api.openai.com/auth": {
				chatgpt_account_id: "acct_retry_new",
			},
		});

		writeCodexAuth({
			tokens: {
				access_token: initialAccessToken,
				refresh_token: "refresh-retry",
				id_token: idToken,
				account_id: "acct_retry",
			},
		});

		let codexCallCount = 0;
		const baseFetch = vi.fn(
			async (
				input: Parameters<typeof fetch>[0],
				init?: Parameters<typeof fetch>[1],
			) => {
				const url =
					typeof input === "string"
						? input
						: input instanceof URL
							? input.toString()
							: input.url;

				if (url === "https://auth.openai.com/oauth/token") {
					const params = new URLSearchParams(String(init?.body ?? ""));
					expect(params.get("grant_type")).toBe("refresh_token");
					expect(params.get("refresh_token")).toBe("refresh-retry");
					expect(params.get("client_id")).toBe("app_client_retry");
					return new Response(
						JSON.stringify({
							access_token: refreshedAccessToken,
							refresh_token: "refresh-retry-new",
							id_token: refreshedIdToken,
							token_type: "bearer",
							expires_in: 864000,
						}),
						{
							status: 200,
							headers: { "content-type": "application/json" },
						},
					);
				}

				codexCallCount += 1;
				const headers = new Headers(init?.headers);
				if (codexCallCount === 1) {
					expect(headers.get("authorization")).toBe(
						`Bearer ${initialAccessToken}`,
					);
					return new Response("unauthorized", { status: 401 });
				}

				expect(codexCallCount).toBe(2);
				expect(headers.get("authorization")).toBe(
					`Bearer ${refreshedAccessToken}`,
				);
				expect(headers.get("chatgpt-account-id")).toBe("acct_retry_new");
				return new Response("{}", { status: 200 });
			},
		);

		const codexFetch = createCodexFetch({ baseFetch });
		await codexFetch("https://chatgpt.com/backend-api/codex/responses", {
			method: "POST",
			body: JSON.stringify({ model: "codex-mini-latest", input: "hello" }),
		});

		expect(codexCallCount).toBe(2);
		expect(baseFetch).toHaveBeenCalledTimes(3);
		const persisted = JSON.parse(readFileSync(getCodexAuthPath(), "utf-8")) as {
			tokens?: Record<string, string>;
		};
		expect(persisted.tokens?.access_token).toBe(refreshedAccessToken);
		expect(persisted.tokens?.refresh_token).toBe("refresh-retry-new");
		expect(persisted.tokens?.account_id).toBe("acct_retry_new");
	});

	it("uses fallback token when codex auth file is unavailable", async () => {
		const baseFetch = vi.fn(
			async (
				_input: Parameters<typeof fetch>[0],
				_init?: Parameters<typeof fetch>[1],
			) => new Response("{}", { status: 200 }),
		);
		const codexFetch = createCodexFetch({
			baseFetch,
			fallbackToken: "fallback-token",
		});

		await codexFetch("https://chatgpt.com/backend-api/codex/responses", {
			method: "POST",
			body: JSON.stringify({ model: "codex-mini-latest", input: "hello" }),
		});

		const requestInit = baseFetch.mock.calls[0]?.[1];
		expect(requestInit).toBeDefined();
		const headers = new Headers(requestInit?.headers);

		expect(headers.get("authorization")).toBe("Bearer fallback-token");
	});

	it("throws when no codex token is available", async () => {
		const baseFetch = vi.fn(
			async (
				_input: Parameters<typeof fetch>[0],
				_init?: Parameters<typeof fetch>[1],
			) => new Response("{}", { status: 200 }),
		);
		const codexFetch = createCodexFetch({ baseFetch });

		await expect(
			codexFetch("https://chatgpt.com/backend-api/codex/responses", {
				method: "POST",
				body: JSON.stringify({ model: "codex-mini-latest", input: "hello" }),
			}),
		).rejects.toThrow(/Codex credentials missing/);
	});
});

function writeCodexAuth(payload: unknown): void {
	const authPath = getCodexAuthPath();
	mkdirSync(dirname(authPath), { recursive: true });
	writeFileSync(authPath, JSON.stringify(payload, null, 2));
}

function createJwt(payload: Record<string, unknown>): string {
	const header = Buffer.from(
		JSON.stringify({ alg: "HS256", typ: "JWT" }),
	).toString("base64url");
	const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
	return `${header}.${body}.signature`;
}
