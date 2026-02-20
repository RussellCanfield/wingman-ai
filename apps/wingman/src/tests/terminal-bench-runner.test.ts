import {
	existsSync,
	mkdirSync,
	mkdtempSync,
	readFileSync,
	rmSync,
	writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { runTerminalBench } from "../bench/runner";

describe("terminal bench runner", () => {
	const workdirs: string[] = [];

	afterEach(() => {
		for (const workdir of workdirs) {
			rmSync(workdir, { recursive: true, force: true });
		}
		workdirs.length = 0;
	});

	it("runs tasks with command adapter and writes artifacts", async () => {
		const workdir = mkdtempSync(join(tmpdir(), "wingman-bench-runner-"));
		workdirs.push(workdir);
		const benchmarkDir = join(workdir, "bench");
		const tasksDir = join(benchmarkDir, "tasks");
		const sandboxDir = join(benchmarkDir, "sandbox");
		mkdirSync(tasksDir, { recursive: true });
		mkdirSync(sandboxDir, { recursive: true });

		writeFileSync(
			join(tasksDir, "suite.json"),
			JSON.stringify(
				{
					tasks: [
						{
							id: "write-output",
							prompt: "FILE_OK",
							workingDirectory: "sandbox",
							setup: [
								{
									command: "rm",
									args: ["-f", "output.txt"],
								},
							],
							validator: {
								type: "file_contains",
								path: "output.txt",
								includes: ["FILE_OK"],
							},
						},
					],
				},
				null,
				2,
			),
		);

		writeFileSync(
			join(benchmarkDir, "config.json"),
			JSON.stringify(
				{
					taskFile: "tasks/suite.json",
					resultsDir: "results",
					adapter: {
						type: "command",
						command: {
							command: "sh",
							args: [
								"-lc",
								"printf '%s\\n' \"$WINGMAN_BENCH_PROMPT\" > output.txt; echo COMPLETE",
							],
						},
					},
				},
				null,
				2,
			),
		);

		const summary = await runTerminalBench({
			configPath: join(benchmarkDir, "config.json"),
		});

		expect(summary.metrics.totalTasks).toBe(1);
		expect(summary.metrics.passedTasks).toBe(1);
		expect(summary.metrics.failedTasks).toBe(0);
		expect(existsSync(join(summary.resultsDir, "summary.json"))).toBe(true);
		expect(
			existsSync(join(summary.resultsDir, "write-output.assistant.txt")),
		).toBe(true);
		expect(readFileSync(join(sandboxDir, "output.txt"), "utf-8")).toContain(
			"FILE_OK",
		);
	});
});
