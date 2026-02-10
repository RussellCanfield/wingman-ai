import {
	existsSync,
	mkdirSync,
	mkdtempSync,
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
