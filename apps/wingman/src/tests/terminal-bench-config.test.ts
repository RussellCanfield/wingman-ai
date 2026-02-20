import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { loadTerminalBenchConfig } from "../bench/config";

describe("terminal bench config", () => {
	const workdirs: string[] = [];

	afterEach(() => {
		for (const workdir of workdirs) {
			rmSync(workdir, { recursive: true, force: true });
		}
		workdirs.length = 0;
	});

	it("loads config/tasks with defaults and resolves relative paths", async () => {
		const workdir = mkdtempSync(join(tmpdir(), "wingman-bench-config-"));
		workdirs.push(workdir);

		const taskFilePath = join(workdir, "tasks.json");
		writeFileSync(
			taskFilePath,
			JSON.stringify(
				{
					tasks: [
						{
							id: "t1",
							prompt: "hello",
							validator: {
								type: "assistant_contains",
								includes: "ok",
							},
						},
					],
				},
				null,
				2,
			),
		);

		const configPath = join(workdir, "config.json");
		writeFileSync(
			configPath,
			JSON.stringify(
				{
					taskFile: "./tasks.json",
					adapter: {
						type: "command",
						command: {
							command: "echo",
							args: ["ok"],
						},
					},
				},
				null,
				2,
			),
		);

		const config = await loadTerminalBenchConfig(configPath);
		expect(config.version).toBe(1);
		expect(config.taskFilePath).toBe(taskFilePath);
		expect(config.resultsDir).toBe(join(workdir, "bench/results"));
		expect(config.run.defaultTimeoutMs).toBe(300_000);
		expect(config.tasks).toHaveLength(1);
		expect(config.tasks[0].validator.type).toBe("assistant_contains");
		if (config.tasks[0].validator.type !== "assistant_contains") {
			throw new Error("Unexpected validator type");
		}
		expect(config.tasks[0].validator.includes).toEqual(["ok"]);
	});
});
