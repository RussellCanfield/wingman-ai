import fs from "node:fs";
import path from "node:path";
import { exec } from "node:child_process";
import { promisify } from "node:util";
import os from "node:os";
// @ts-ignore
import PCR from "puppeteer-chromium-resolver";

const execAsync = promisify(exec);

export default function getGlobalStoragePath(folder: string): string {
	const homeDir = os.homedir();
	const targetPath = path.join(
		homeDir,
		".wingman",
		path.basename(folder),
		folder,
	);
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
