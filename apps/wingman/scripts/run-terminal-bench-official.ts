#!/usr/bin/env bun

import { runOfficialTerminalBench } from "../src/bench/official.js";
import { parseOfficialBenchArgs } from "../src/bench/officialCli.js";

async function main(): Promise<void> {
	const parsed = parseOfficialBenchArgs(process.argv);
	const summary = await runOfficialTerminalBench(parsed);

	console.log(`Official run duration: ${summary.durationMs} ms`);
	console.log(`Container runtime: ${summary.runtime.containerRuntime}`);
	console.log(`Wrapper summary: ${summary.artifacts.summaryPath}`);
	if (summary.runOutputPath) {
		console.log(`Harbor output: ${summary.runOutputPath}`);
	}
	if (typeof summary.metrics.accuracyPercent === "number") {
		console.log(`Accuracy: ${summary.metrics.accuracyPercent.toFixed(2)}%`);
	}
	if (typeof summary.metrics.resolvedTrials === "number") {
		console.log(`Resolved: ${summary.metrics.resolvedTrials}`);
	}
	if (typeof summary.metrics.unresolvedTrials === "number") {
		console.log(`Unresolved: ${summary.metrics.unresolvedTrials}`);
	}
	for (const [k, value] of Object.entries(summary.metrics.passAtK)) {
		console.log(`Pass@${k}: ${value.toFixed(2)}%`);
	}
	if (summary.errorMessage) {
		console.error(`Harbor error: ${summary.errorMessage}`);
	}

	if (summary.exitCode !== 0 || summary.timedOut) {
		process.exit(1);
	}
}

if (import.meta.main) {
	await main();
}
