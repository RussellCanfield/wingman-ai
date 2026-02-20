import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { buildTerminalBenchSummary } from "../bench/scoring";
import type {
	TaskRunResult,
	TerminalBenchResolvedConfig,
} from "../bench/types";

function createTask(
	id: string,
	status: "passed" | "failed",
	durationMs: number,
): TaskRunResult {
	return {
		taskId: id,
		status,
		workingDirectory: "/tmp",
		prompt: "prompt",
		startedAt: new Date().toISOString(),
		endedAt: new Date().toISOString(),
		durationMs,
		setup: { runCount: 0 },
		adapter: {
			exitCode: status === "passed" ? 0 : 1,
			timedOut: false,
			durationMs,
			stdout: "",
			stderr: "",
			assistantText: "ok",
			tokens: {
				inputTokens: 100,
				outputTokens: 200,
				totalTokens: 300,
			},
		},
		validator: {
			passed: status === "passed",
			details: status,
		},
		artifacts: {
			stdoutFile: "stdout.log",
			stderrFile: "stderr.log",
			assistantFile: "assistant.txt",
			recordFile: "record.json",
		},
	};
}

function createConfig(workdir: string): TerminalBenchResolvedConfig {
	return {
		version: 1,
		configPath: join(workdir, "config.json"),
		taskFilePath: join(workdir, "tasks.json"),
		resultsDir: join(workdir, "results"),
		run: {
			defaultTimeoutMs: 10_000,
			continueOnFailure: true,
		},
		adapter: {
			type: "command",
			command: {
				command: "echo",
			},
		},
		tasks: [],
		scoring: {
			weights: {
				passRate: 0.8,
				reliability: 0.2,
				duration: 0,
				cost: 0,
			},
			budgets: {},
			pricing: {
				inputPer1kTokensUsd: 0.001,
				outputPer1kTokensUsd: 0.002,
			},
		},
		qualityGate: {
			enabled: true,
			baselineFile: join(workdir, "baseline.json"),
			minPassRateDelta: -0.1,
			maxCostIncreaseRatio: 1,
			maxAvgDurationIncreaseRatio: 1,
		},
		metadata: {},
	};
}

describe("terminal bench scoring", () => {
	const workdirs: string[] = [];

	afterEach(() => {
		for (const workdir of workdirs) {
			rmSync(workdir, { recursive: true, force: true });
		}
		workdirs.length = 0;
	});

	it("computes summary metrics and applies quality gate", async () => {
		const workdir = mkdtempSync(join(tmpdir(), "wingman-bench-score-"));
		workdirs.push(workdir);

		const baseline = {
			metrics: {
				passRate: 1,
				totalCostUsd: 0.001,
				avgDurationMs: 100,
			},
		};
		writeFileSync(join(workdir, "baseline.json"), JSON.stringify(baseline));

		const summary = await buildTerminalBenchSummary({
			runId: "run-1",
			startedAt: new Date().toISOString(),
			endedAt: new Date().toISOString(),
			config: createConfig(workdir),
			resultsDir: join(workdir, "results", "run-1"),
			tasks: [createTask("a", "passed", 100), createTask("b", "failed", 200)],
		});

		expect(summary.metrics.totalTasks).toBe(2);
		expect(summary.metrics.passedTasks).toBe(1);
		expect(summary.metrics.passRate).toBeCloseTo(0.5);
		expect(summary.metrics.totalTokens).toBe(600);
		expect(summary.metrics.totalCostUsd).toBeCloseTo(0.001);
		expect(summary.qualityGate.passed).toBe(false);
		expect(summary.qualityGate.messages.length).toBeGreaterThan(0);
	});
});
