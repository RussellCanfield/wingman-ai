#!/usr/bin/env bun

import { cleanBenchArtifacts } from "../src/bench/cleanup.js";

async function main(): Promise<void> {
	const args = process.argv.slice(2);
	const dryRun = args.includes("--dry-run");
	const result = await cleanBenchArtifacts(process.cwd(), { dryRun });

	console.log(dryRun ? "Dry run cleanup targets:" : "Removed bench artifacts:");
	for (const path of result.removedPaths) {
		console.log(path);
	}

	if (result.missingPaths.length > 0) {
		console.warn("Skipped missing/unremovable paths:");
		for (const path of result.missingPaths) {
			console.warn(path);
		}
	}

	console.log(
		`Total paths ${dryRun ? "targeted" : "removed"}: ${result.removedPaths.length}`,
	);
}

if (import.meta.main) {
	await main();
}
