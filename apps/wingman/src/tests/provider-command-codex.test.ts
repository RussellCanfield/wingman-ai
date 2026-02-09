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
import { executeProviderCommand } from "@/cli/commands/provider.js";
import { getCodexAuthPath } from "@/providers/codex.js";

describe("provider command codex login", () => {
	let codexHome: string;
	const originalCodexHome = process.env.CODEX_HOME;

	beforeEach(() => {
		codexHome = mkdtempSync(join(tmpdir(), "wingman-provider-codex-"));
		process.env.CODEX_HOME = codexHome;
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

	it("uses existing codex login without requiring a token", async () => {
		const authPath = getCodexAuthPath();
		mkdirSync(dirname(authPath), { recursive: true });
		writeFileSync(
			authPath,
			JSON.stringify(
				{
					tokens: {
						access_token: "codex-access-token",
						account_id: "acct_123",
					},
				},
				null,
				2,
			),
		);

		const exitSpy = vi.spyOn(process, "exit").mockImplementation(((
			code?: number,
		) => {
			throw new Error(`process.exit(${code ?? "undefined"})`);
		}) as never);

		try {
			await expect(
				executeProviderCommand({
					subcommand: "login",
					args: ["codex"],
					verbosity: "silent",
					outputMode: "json",
					options: {},
				}),
			).resolves.toBeUndefined();
			expect(exitSpy).not.toHaveBeenCalled();
		} finally {
			exitSpy.mockRestore();
		}
	});
});
