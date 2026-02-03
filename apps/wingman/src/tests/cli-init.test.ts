import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { executeInitCommand } from "../cli/commands/init";
import {
	existsSync,
	mkdtempSync,
	mkdirSync,
	readFileSync,
	rmSync,
	writeFileSync,
} from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

describe("CLI init", () => {
	let workspace: string;

	beforeEach(() => {
		workspace = mkdtempSync(join(tmpdir(), "wingman-init-"));
	});

	afterEach(() => {
		if (existsSync(workspace)) {
			rmSync(workspace, { recursive: true, force: true });
		}
	});

	it("creates config and agent with defaults", async () => {
		await executeInitCommand(
			{
				subcommand: "",
				args: [],
				verbosity: "silent",
				outputMode: "json",
				options: { yes: true, "skip-provider": true },
				agent: "wingman",
			},
			{ workspace },
		);

		const configPath = join(
			workspace,
			".wingman",
			"wingman.config.json",
		);
		expect(existsSync(configPath)).toBe(true);
		const config = JSON.parse(readFileSync(configPath, "utf-8"));
		expect(config.defaultAgent).toBe("wingman");
		expect(config.gateway.fsRoots).toContain(".");

		const agentPath = join(
			workspace,
			".wingman",
			"agents",
			"wingman",
			"agent.json",
		);
		expect(existsSync(agentPath)).toBe(true);
		const agent = JSON.parse(readFileSync(agentPath, "utf-8"));
		expect(agent.name).toBe("wingman");
	});

	it("merges existing config when --merge is set", async () => {
		const configDir = join(workspace, ".wingman");
		mkdirSync(configDir, { recursive: true });
		const configPath = join(configDir, "wingman.config.json");

		writeFileSync(
			configPath,
			JSON.stringify(
				{
					logLevel: "debug",
					gateway: { fsRoots: ["./existing"] },
				},
				null,
				2,
			),
		);

		await executeInitCommand(
			{
				subcommand: "",
				args: [],
				verbosity: "silent",
				outputMode: "json",
				options: { merge: true, "skip-provider": true },
				agent: "wingman",
			},
			{ workspace },
		);

		const updated = JSON.parse(readFileSync(configPath, "utf-8"));
		expect(updated.logLevel).toBe("debug");
		expect(updated.defaultAgent).toBe("wingman");
		expect(updated.gateway.fsRoots).toEqual(
			expect.arrayContaining(["./existing", "."]),
		);
	});
});
