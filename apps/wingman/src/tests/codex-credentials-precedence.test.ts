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

describe("codex credential precedence", () => {
	let homeDir: string;
	let codexHome: string;
	const originalHome = process.env.HOME;
	const originalCodexHome = process.env.CODEX_HOME;
	const originalCodexAccessToken = process.env.CODEX_ACCESS_TOKEN;
	const originalChatGptAccessToken = process.env.CHATGPT_ACCESS_TOKEN;

	beforeEach(() => {
		homeDir = mkdtempSync(join(tmpdir(), "wingman-home-"));
		codexHome = mkdtempSync(join(tmpdir(), "wingman-codex-home-"));

		process.env.HOME = homeDir;
		process.env.CODEX_HOME = codexHome;
		delete process.env.CODEX_ACCESS_TOKEN;
		delete process.env.CHATGPT_ACCESS_TOKEN;
	});

	afterEach(() => {
		if (originalHome === undefined) {
			delete process.env.HOME;
		} else {
			process.env.HOME = originalHome;
		}

		if (originalCodexHome === undefined) {
			delete process.env.CODEX_HOME;
		} else {
			process.env.CODEX_HOME = originalCodexHome;
		}

		if (originalCodexAccessToken === undefined) {
			delete process.env.CODEX_ACCESS_TOKEN;
		} else {
			process.env.CODEX_ACCESS_TOKEN = originalCodexAccessToken;
		}

		if (originalChatGptAccessToken === undefined) {
			delete process.env.CHATGPT_ACCESS_TOKEN;
		} else {
			process.env.CHATGPT_ACCESS_TOKEN = originalChatGptAccessToken;
		}

		if (existsSync(homeDir)) {
			rmSync(homeDir, { recursive: true, force: true });
		}
		if (existsSync(codexHome)) {
			rmSync(codexHome, { recursive: true, force: true });
		}
	});

	it("prefers Codex auth file over stored Wingman credentials for codex", async () => {
		vi.resetModules();
		const credentials = await import("@/providers/credentials.js");
		const codex = await import("@/providers/codex.js");

		const credsPath = credentials.getCredentialsPath();
		mkdirSync(dirname(credsPath), { recursive: true });
		writeFileSync(
			credsPath,
			JSON.stringify(
				{
					version: 1,
					updatedAt: new Date().toISOString(),
					providers: {
						codex: { apiKey: "stale-wingman-token" },
					},
				},
				null,
				2,
			),
		);

		const authPath = codex.getCodexAuthPath();
		mkdirSync(dirname(authPath), { recursive: true });
		writeFileSync(
			authPath,
			JSON.stringify(
				{
					tokens: {
						access_token: "codex-file-token",
						account_id: "acct_123",
					},
				},
				null,
				2,
			),
		);

		const resolved = credentials.resolveProviderToken("codex");
		expect(resolved.token).toBe("codex-file-token");
		expect(resolved.source).toBe("credentials");
	});

	it("still prefers env vars over Codex auth file", async () => {
		process.env.CODEX_ACCESS_TOKEN = "env-token";

		vi.resetModules();
		const credentials = await import("@/providers/credentials.js");
		const codex = await import("@/providers/codex.js");

		const authPath = codex.getCodexAuthPath();
		mkdirSync(dirname(authPath), { recursive: true });
		writeFileSync(
			authPath,
			JSON.stringify(
				{
					tokens: {
						access_token: "codex-file-token",
					},
				},
				null,
				2,
			),
		);

		const resolved = credentials.resolveProviderToken("codex");
		expect(resolved.token).toBe("env-token");
		expect(resolved.source).toBe("env");
		expect(readFileSync(authPath, "utf-8")).toContain("codex-file-token");
	});
});
