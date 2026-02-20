#!/usr/bin/env bun

import { copyFile, readdir, stat } from "node:fs/promises";
import { join, resolve } from "node:path";

function parseArgs(argv: string[]): { runDir?: string } {
	const args = argv.slice(2);
	let runDir: string | undefined;

	for (let i = 0; i < args.length; i += 1) {
		if ((args[i] === "--run-dir" || args[i] === "-r") && args[i + 1]) {
			runDir = args[i + 1];
			i += 1;
			continue;
		}
		if (args[i].startsWith("--run-dir=")) {
			runDir = args[i].slice("--run-dir=".length);
		}
	}

	return { runDir };
}

async function findLatestRun(resultsDir: string): Promise<string> {
	const entries = await readdir(resultsDir, { withFileTypes: true });
	const directories = entries.filter((entry) => entry.isDirectory());
	if (directories.length === 0) {
		throw new Error(`No benchmark run directories found under ${resultsDir}`);
	}

	let latestPath = "";
	let latestTime = 0;
	for (const directory of directories) {
		const path = join(resultsDir, directory.name);
		const info = await stat(path);
		if (info.mtimeMs > latestTime) {
			latestTime = info.mtimeMs;
			latestPath = path;
		}
	}

	if (!latestPath) {
		throw new Error(`Unable to resolve latest run under ${resultsDir}`);
	}
	return latestPath;
}

async function main(): Promise<void> {
	const args = parseArgs(process.argv);
	const repoRoot = process.cwd();
	const resultsRoot = resolve(repoRoot, "bench/results");
	const baselinePath = resolve(repoRoot, "bench/baselines/latest-summary.json");
	const runDir = args.runDir
		? resolve(repoRoot, args.runDir)
		: await findLatestRun(resultsRoot);
	const sourceSummary = join(runDir, "summary.json");

	await copyFile(sourceSummary, baselinePath);
	console.log(`Baseline updated: ${baselinePath}`);
	console.log(`Source summary: ${sourceSummary}`);
}

await main();
