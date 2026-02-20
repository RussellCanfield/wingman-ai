import { mkdirSync, writeFileSync } from "node:fs";
import { access, mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
	cleanBenchArtifacts,
	getBenchCleanupTargets,
} from "../bench/cleanup.js";

const tempDirs: string[] = [];

async function pathExists(path: string): Promise<boolean> {
	try {
		await access(path);
		return true;
	} catch {
		return false;
	}
}

describe("terminal bench cleanup", () => {
	afterEach(async () => {
		for (const dir of tempDirs) {
			await rm(dir, { recursive: true, force: true });
		}
		tempDirs.length = 0;
	});

	it("targets generated bench artifacts only", async () => {
		const root = await mkdtemp(join(tmpdir(), "wingman-bench-cleanup-"));
		tempDirs.push(root);

		const jobsRun = join(root, "jobs", "2026-01-01__00-00-00");
		const officialRun = join(
			root,
			"bench",
			"results",
			"official",
			"2026-01-01__00-00-00",
		);
		const wrapperRun = join(
			root,
			"bench",
			"results",
			"official-wrapper",
			"2026-01-01T00-00-00-000Z",
		);
		const pycacheDir = join(root, "bench", "harbor_agents", "__pycache__");
		const configPath = join(root, "bench", "config.tb2-wingman.json");

		mkdirSync(jobsRun, { recursive: true });
		mkdirSync(officialRun, { recursive: true });
		mkdirSync(wrapperRun, { recursive: true });
		mkdirSync(pycacheDir, { recursive: true });
		writeFileSync(join(jobsRun, "result.json"), "{}");
		writeFileSync(join(officialRun, "result.json"), "{}");
		writeFileSync(join(wrapperRun, "summary.json"), "{}");
		writeFileSync(join(pycacheDir, "cache.pyc"), "x");
		writeFileSync(configPath, "{}");

		const targets = await getBenchCleanupTargets(root);
		expect(targets).toContain(jobsRun);
		expect(targets).toContain(officialRun);
		expect(targets).toContain(wrapperRun);
		expect(targets).toContain(pycacheDir);
		expect(targets).not.toContain(configPath);
	});

	it("removes generated artifacts and keeps config files", async () => {
		const root = await mkdtemp(join(tmpdir(), "wingman-bench-cleanup-"));
		tempDirs.push(root);

		const jobsRun = join(root, "jobs", "2026-01-01__00-00-00");
		const officialRun = join(
			root,
			"bench",
			"results",
			"official",
			"2026-01-01__00-00-00",
		);
		const wrapperRun = join(
			root,
			"bench",
			"results",
			"official-wrapper",
			"2026-01-01T00-00-00-000Z",
		);
		const pycacheDir = join(root, "bench", "harbor_agents", "__pycache__");
		const configPath = join(root, "bench", "config.tb2-wingman.json");

		mkdirSync(jobsRun, { recursive: true });
		mkdirSync(officialRun, { recursive: true });
		mkdirSync(wrapperRun, { recursive: true });
		mkdirSync(pycacheDir, { recursive: true });
		writeFileSync(configPath, '{"dataset":"terminal-bench@2.0"}');

		const result = await cleanBenchArtifacts(root);
		expect(result.missingPaths).toHaveLength(0);
		expect(result.removedPaths.length).toBeGreaterThanOrEqual(4);

		expect(await pathExists(jobsRun)).toBe(false);
		expect(await pathExists(officialRun)).toBe(false);
		expect(await pathExists(wrapperRun)).toBe(false);
		expect(await pathExists(pycacheDir)).toBe(false);
		expect(await pathExists(configPath)).toBe(true);
		expect(await readFile(configPath, "utf-8")).toContain("terminal-bench@2.0");
	});
});
