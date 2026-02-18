import { describe, expect, test } from "vitest";
import { spawnSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const SCRIPT_PATH = resolve(
	dirname(fileURLToPath(import.meta.url)),
	"../../scripts/macos-publish.sh",
);

function hasBash(): boolean {
	const result = spawnSync("bash", ["--version"], {
		encoding: "utf8",
	});
	return result.status === 0;
}

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
});
