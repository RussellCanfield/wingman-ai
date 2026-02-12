import { spawnSync } from "node:child_process";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { delimiter, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, test } from "vitest";

const SCRIPT_PATH = resolve(
	dirname(fileURLToPath(import.meta.url)),
	"../scripts/macos-publish.sh",
);

const tempDirs: string[] = [];

function hasBash(): boolean {
	const result = spawnSync("bash", ["--version"], { encoding: "utf8" });
	return result.status === 0;
}

function writeExecutable(path: string, content: string): void {
	writeFileSync(path, `#!/usr/bin/env bash\nset -euo pipefail\n${content}\n`, {
		mode: 0o755,
	});
}

function setupFixture(securityOutput: string): {
	appPath: string;
	binDir: string;
	dmgPath: string;
} {
	const root = mkdtempSync(resolve(tmpdir(), "wingman-macos-publish-"));
	tempDirs.push(root);

	const appPath = resolve(root, "Wingman Companion.app");
	const dmgPath = resolve(root, "Wingman Companion.dmg");
	const binDir = resolve(root, "bin");

	mkdirSync(appPath, { recursive: true });
	writeFileSync(dmgPath, "");
	mkdirSync(binDir, { recursive: true });

	writeExecutable(resolve(binDir, "codesign"), ":");
	writeExecutable(resolve(binDir, "hdiutil"), ":");
	writeExecutable(
		resolve(binDir, "security"),
		`cat <<'SECURITY_OUTPUT'\n${securityOutput}\nSECURITY_OUTPUT`,
	);

	return { appPath, binDir, dmgPath };
}

afterEach(() => {
	for (const tempDir of tempDirs.splice(0)) {
		rmSync(tempDir, { force: true, recursive: true });
	}
});

describe("macOS publish script", () => {
	test("prints help output", () => {
		if (process.platform === "win32" || !hasBash()) {
			return;
		}

		const result = spawnSync("bash", [SCRIPT_PATH, "--help"], {
			encoding: "utf8",
		});

		expect(result.status).toBe(0);
		expect(result.stdout).toContain("Usage:");
		expect(result.stdout).toContain("<build|sign|notarize|verify|all>");
	});

	test("auto-detects a single Developer ID identity", () => {
		if (process.platform === "win32" || !hasBash()) {
			return;
		}

		const identity = "Developer ID Application: Wingman AI (ABCD123456)";
		const fixture = setupFixture(
			`  1) 1234567890ABCDEF \"${identity}\"\n     1 valid identities found`,
		);

		const result = spawnSync(
			"bash",
			[
				SCRIPT_PATH,
				"sign",
				"--dry-run",
				"--app",
				fixture.appPath,
				"--dmg",
				fixture.dmgPath,
			],
			{
				encoding: "utf8",
				env: {
					...process.env,
					IDENTITY: "",
					MACOS_SIGN_IDENTITY: "",
					PATH: `${fixture.binDir}${delimiter}${process.env.PATH ?? ""}`,
				},
			},
		);

		expect(result.status).toBe(0);
		expect(result.stdout).toContain(`Using signing identity: ${identity}`);
		expect(result.stdout).toContain(`--sign ${identity}`);
	});

	test("fails when multiple Developer ID identities are available", () => {
		if (process.platform === "win32" || !hasBash()) {
			return;
		}

		const fixture = setupFixture(`
  1) AAAAAAAAAAAAAAAAAAAA "Developer ID Application: Wingman One (AAA1111111)"
  2) BBBBBBBBBBBBBBBBBBBB "Developer ID Application: Wingman Two (BBB2222222)"
     2 valid identities found
`.trim());

		const result = spawnSync(
			"bash",
			[
				SCRIPT_PATH,
				"sign",
				"--dry-run",
				"--app",
				fixture.appPath,
				"--dmg",
				fixture.dmgPath,
			],
			{
				encoding: "utf8",
				env: {
					...process.env,
					IDENTITY: "",
					MACOS_SIGN_IDENTITY: "",
					PATH: `${fixture.binDir}${delimiter}${process.env.PATH ?? ""}`,
				},
			},
		);

		expect(result.status).toBe(1);
		expect(result.stdout).toContain("Found multiple Developer ID Application identities:");
		expect(result.stderr).toContain(
			"Error: Multiple signing identities found. Pass --identity to choose one.",
		);
	});
});
