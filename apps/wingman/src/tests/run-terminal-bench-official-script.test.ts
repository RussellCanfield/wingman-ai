import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { parseOfficialBenchArgs } from "../bench/officialCli";

describe("run-terminal-bench-official cli args", () => {
	it("parses wingman bridge options", () => {
		const parsed = parseOfficialBenchArgs([
			"bun",
			"run-terminal-bench-official.ts",
			"--config",
			"bench/config.tb2-wingman.json",
			"--task-id",
			"heterogeneous-dates",
			"--n-attempts",
			"3",
			"--n-tasks",
			"2",
			"--wingman-agent",
			"coding",
			"--wingman-model",
			"openai/gpt-5",
		]);

		expect(parsed.configPath).toBe(
			join(process.cwd(), "bench/config.tb2-wingman.json"),
		);
		expect(parsed.overrides.taskNames).toEqual(["heterogeneous-dates"]);
		expect(parsed.overrides.nAttempts).toBe(3);
		expect(parsed.overrides.nTasks).toBe(2);
		expect(parsed.overrides.agentKwargs).toEqual({
			wingman_agent: "coding",
			wingman_model: "openai:gpt-5",
		});
	});

	it("uses all dataset tasks when --all-tasks is set", () => {
		const parsed = parseOfficialBenchArgs([
			"bun",
			"run-terminal-bench-official.ts",
			"--task-name",
			"heterogeneous-dates",
			"--all-tasks",
		]);
		expect(parsed.overrides.taskNames).toEqual([]);
	});

	it("parses explicit registry options", () => {
		const parsed = parseOfficialBenchArgs([
			"bun",
			"run-terminal-bench-official.ts",
			"--registry-url",
			"https://example.com/registry.json",
			"--registry-path",
			"/tmp/registry.json",
		]);
		expect(parsed.overrides.registryUrl).toBe(
			"https://example.com/registry.json",
		);
		expect(parsed.overrides.registryPath).toBe("/tmp/registry.json");
	});
});
