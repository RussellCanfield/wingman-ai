import { existsSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { clearStaleDevtoolsArtifacts } from "../tools/browser_control";

describe("browser_control helpers", () => {
	const tempDirs: string[] = [];

	afterEach(() => {
		for (const dir of tempDirs) {
			rmSync(dir, { recursive: true, force: true });
		}
		tempDirs.length = 0;
	});

	it("removes stale DevToolsActivePort before launch", () => {
		const userDataDir = mkdtempSync(join(tmpdir(), "wingman-browser-profile-"));
		tempDirs.push(userDataDir);
		const activePortPath = join(userDataDir, "DevToolsActivePort");
		writeFileSync(activePortPath, "52145\n/devtools/browser/stale");
		expect(existsSync(activePortPath)).toBe(true);

		clearStaleDevtoolsArtifacts(userDataDir);

		expect(existsSync(activePortPath)).toBe(false);
	});

	it("does not throw when DevToolsActivePort is absent", () => {
		const userDataDir = mkdtempSync(join(tmpdir(), "wingman-browser-profile-"));
		tempDirs.push(userDataDir);

		expect(() => clearStaleDevtoolsArtifacts(userDataDir)).not.toThrow();
	});
});
