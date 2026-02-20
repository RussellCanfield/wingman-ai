#!/usr/bin/env bun

import { resolve } from "node:path";
import { runTerminalBench } from "../src/bench/runner.js";

function parseArgs(argv: string[]): { configPath: string } {
	const args = argv.slice(2);
	let configPath = "bench/config.json";

	for (let i = 0; i < args.length; i += 1) {
		if ((args[i] === "--config" || args[i] === "-c") && args[i + 1]) {
			configPath = args[i + 1];
			i += 1;
			continue;
		}
		if (args[i].startsWith("--config=")) {
			configPath = args[i].slice("--config=".length);
		}
	}

	return { configPath: resolve(process.cwd(), configPath) };
}

function printSummary(
	summary: Awaited<ReturnType<typeof runTerminalBench>>,
): void {
	console.log(`Run ID: ${summary.runId}`);
	console.log(`Results dir: ${summary.resultsDir}`);
	console.log(`Overall score: ${summary.metrics.overallScore.toFixed(2)}`);
	console.log(
		`Pass rate: ${(summary.metrics.passRate * 100).toFixed(2)}% (${summary.metrics.passedTasks}/${summary.metrics.totalTasks})`,
	);
	console.log(
		`Average duration: ${summary.metrics.avgDurationMs.toFixed(0)} ms`,
	);
	console.log(`Total cost: $${summary.metrics.totalCostUsd.toFixed(4)}`);
	console.log(
		`Quality gate: ${summary.qualityGate.passed ? "passed" : "failed"}`,
	);
	if (summary.qualityGate.messages.length > 0) {
		for (const message of summary.qualityGate.messages) {
			console.log(`- ${message}`);
		}
	}
}

async function main(): Promise<void> {
	const args = parseArgs(process.argv);
	const summary = await runTerminalBench({ configPath: args.configPath });
	printSummary(summary);

	if (!summary.qualityGate.passed) {
		process.exit(2);
	}
	if (summary.metrics.failedTasks > 0) {
		process.exit(1);
	}
}

await main();
