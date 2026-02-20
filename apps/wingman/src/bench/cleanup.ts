import { readdir, rm } from "node:fs/promises";
import { join, resolve } from "node:path";

export interface BenchCleanupResult {
	removedPaths: string[];
	missingPaths: string[];
}

export interface BenchCleanupOptions {
	dryRun?: boolean;
}

async function listImmediateChildren(dirPath: string): Promise<string[]> {
	try {
		const entries = await readdir(dirPath, {
			withFileTypes: true,
			encoding: "utf8",
		});
		return entries.map((entry) => join(dirPath, entry.name));
	} catch {
		return [];
	}
}

async function collectPycacheDirs(rootPath: string): Promise<string[]> {
	const discovered: string[] = [];
	const queue = [rootPath];

	while (queue.length > 0) {
		const current = queue.shift();
		if (!current) continue;

		let entries;
		try {
			entries = await readdir(current, {
				withFileTypes: true,
				encoding: "utf8",
			});
		} catch {
			continue;
		}

		for (const entry of entries) {
			if (!entry.isDirectory()) continue;
			const entryName =
				typeof entry.name === "string" ? entry.name : String(entry.name);
			const child = join(current, entryName);
			if (entryName === "__pycache__") {
				discovered.push(child);
				continue;
			}
			queue.push(child);
		}
	}

	return discovered;
}

export async function getBenchCleanupTargets(
	workspaceRoot: string,
): Promise<string[]> {
	const root = resolve(workspaceRoot);
	const jobsDir = join(root, "jobs");
	const officialResultsDir = join(root, "bench", "results", "official");
	const wrapperResultsDir = join(root, "bench", "results", "official-wrapper");
	const benchDir = join(root, "bench");

	const [jobArtifacts, officialArtifacts, wrapperArtifacts, pycacheDirs] =
		await Promise.all([
			listImmediateChildren(jobsDir),
			listImmediateChildren(officialResultsDir),
			listImmediateChildren(wrapperResultsDir),
			collectPycacheDirs(benchDir),
		]);

	return Array.from(
		new Set([
			...jobArtifacts,
			...officialArtifacts,
			...wrapperArtifacts,
			...pycacheDirs,
		]),
	);
}

export async function cleanBenchArtifacts(
	workspaceRoot: string,
	options: BenchCleanupOptions = {},
): Promise<BenchCleanupResult> {
	const targets = await getBenchCleanupTargets(workspaceRoot);
	const removedPaths: string[] = [];
	const missingPaths: string[] = [];

	for (const target of targets) {
		try {
			if (options.dryRun) {
				removedPaths.push(target);
				continue;
			}
			await rm(target, { recursive: true, force: false });
			removedPaths.push(target);
		} catch {
			missingPaths.push(target);
		}
	}

	return { removedPaths, missingPaths };
}
