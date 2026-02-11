import { describe, expect, test } from "vitest";
import { spawnSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const SCRIPT_PATH = resolve(
	dirname(fileURLToPath(import.meta.url)),
	"../scripts/windows-publish.ps1",
);

function hasPwsh(): boolean {
	const result = spawnSync("pwsh", ["-NoProfile", "-Command", "$PSVersionTable.PSVersion"], {
		encoding: "utf8",
	});
	return result.status === 0;
}

describe("Windows publish script", () => {
	test("prints help output", () => {
		if (!hasPwsh()) {
			return;
		}
		const result = spawnSync(
			"pwsh",
			["-NoProfile", "-File", SCRIPT_PATH, "help"],
			{
				encoding: "utf8",
			},
		);
		expect(result.status).toBe(0);
		expect(result.stdout).toContain("Usage:");
		expect(result.stdout).toContain("<build|sign|verify|all>");
	});
});
