import path from "node:path";
import fs from "node:fs";
// @ts-ignore
import PCR from "puppeteer-chromium-resolver";

export const ensureChromium = async (globalStoragePath: string) => {
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
};
