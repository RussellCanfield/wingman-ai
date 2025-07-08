import fs from "node:fs";
import path from "node:path";
import { exec } from "node:child_process";
import { promisify } from "node:util";
import os from "node:os";
// @ts-ignore
import PCR from "puppeteer-chromium-resolver";

const execAsync = promisify(exec);

export default function getGlobalStoragePath(cwd: string): string {
	const homeDir = os.homedir();
	const targetPath = path.join(homeDir, ".wingman", path.basename(cwd));
	return targetPath;
}

export async function isGitAvailable(): Promise<boolean> {
	try {
		await execAsync("git --version");
		return true;
	} catch (error) {
		return false;
	}
}

export async function getRepoRoot(path: string): Promise<string> {
	try {
		const { stdout } = await execAsync("git rev-parse --show-toplevel", {
			cwd: path,
		});
		return stdout.trim();
	} catch (error) {
		console.warn(
			`[BackgroundWorker] Failed to get repo root, falling back to repoPath: ${error}`,
		);
		return path;
	}
}

export async function getCurrentBranch(
	repoRoot: string,
): Promise<string | undefined> {
	try {
		const { stdout } = await execAsync("git branch --show-current", {
			cwd: repoRoot,
		});
		return stdout.trim();
	} catch (error) {
		console.warn(`Failed to get current branch, using main branch: ${error}`);
	}
}

export async function loadWingmanRules(workspace: string) {
	try {
		if (!fs.existsSync(path.join(workspace, ".wingmanrules"))) {
			return;
		}

		const wingmanRules = await fs.promises.readFile(
			path.join(workspace, ".wingmanrules"),
			"utf-8",
		);
		return wingmanRules;
	} catch (e) {
		console.error("Failed to load wingman rules", e);
	}
}

export async function ensureChromium(globalStoragePath: string) {
	if (!globalStoragePath) {
		throw new Error("Global storage uri is invalid");
	}
	const puppeteerDir = path.join(globalStoragePath, "puppeteer");
	const dirExists = fs.existsSync(puppeteerDir);
	if (!dirExists) {
		await fs.promises.mkdir(puppeteerDir, { recursive: true });
	}
	//@ts-expect-error
	const stats: PCRStats = await PCR({
		downloadPath: puppeteerDir,
	});
	return stats;
}

export async function loadFiles(cwd: string, files: string[]) {
	const loadedFiles: { path: string; code: string }[] = [];

	for (const file of files) {
		const filePath = path.join(cwd, file);
		if (fs.existsSync(filePath)) {
			const code = await fs.promises.readFile(filePath, "utf-8");
			loadedFiles.push({ path: filePath, code });
		}
	}

	return loadedFiles;
}
