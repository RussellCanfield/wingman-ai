import { EventEmitter } from "node:events";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockSpawn, mockEnsureUvAvailableForFeature } = vi.hoisted(() => ({
	mockSpawn: vi.fn(),
	mockEnsureUvAvailableForFeature: vi.fn(),
}));

vi.mock("node:child_process", () => ({
	spawn: mockSpawn,
}));

vi.mock("@/utils/uv.js", () => ({
	ensureUvAvailableForFeature: mockEnsureUvAvailableForFeature,
}));

import { scanSkillDirectory } from "@/cli/services/skillSecurityScanner.js";

type MockChildProcess = EventEmitter & {
	stdout: EventEmitter;
	stderr: EventEmitter;
};

const createMockChildProcess = (input: {
	exitCode: number;
	stdout?: string;
	stderr?: string;
}): MockChildProcess => {
	const child = new EventEmitter() as MockChildProcess;
	child.stdout = new EventEmitter();
	child.stderr = new EventEmitter();

	queueMicrotask(() => {
		if (input.stdout) {
			child.stdout.emit("data", Buffer.from(input.stdout));
		}
		if (input.stderr) {
			child.stderr.emit("data", Buffer.from(input.stderr));
		}
		child.emit("close", input.exitCode);
	});

	return child;
};

const createLogger = () => ({
	debug: vi.fn(),
	info: vi.fn(),
	warn: vi.fn(),
	error: vi.fn(),
});

describe("skill security scanner", () => {
	beforeEach(() => {
		mockSpawn.mockReset();
		mockEnsureUvAvailableForFeature.mockReset();
	});

	it("skips execution when scanOnInstall is disabled", async () => {
		const logger = createLogger();

		await scanSkillDirectory("/tmp/skill", logger, {
			scanOnInstall: false,
		});

		expect(mockEnsureUvAvailableForFeature).not.toHaveBeenCalled();
		expect(mockSpawn).not.toHaveBeenCalled();
	});

	it("blocks installation when blocking issue codes are reported", async () => {
		const logger = createLogger();
		mockSpawn.mockReturnValue(
			createMockChildProcess({
				exitCode: 0,
				stdout: JSON.stringify({
					"/tmp/skill": {
						issues: [{ code: "MCP501", message: "dangerous behavior" }],
					},
				}),
			}),
		);

		await expect(
			scanSkillDirectory("/tmp/skill", logger, {
				scannerCommand: "uvx",
				scannerArgs: ["scan", "--json"],
				blockIssueCodes: ["MCP501"],
			}),
		).rejects.toThrow(/MCP501/);

		expect(mockEnsureUvAvailableForFeature).toHaveBeenCalledWith(
			"uvx",
			"skills.security.scanOnInstall",
		);
		expect(mockSpawn).toHaveBeenCalledWith(
			"uvx",
			["scan", "--json", "/tmp/skill"],
			expect.objectContaining({ stdio: ["ignore", "pipe", "pipe"] }),
		);
	});

	it("logs non-blocking issues and continues", async () => {
		const logger = createLogger();
		mockSpawn.mockReturnValue(
			createMockChildProcess({
				exitCode: 0,
				stdout: JSON.stringify({
					"/tmp/skill": {
						issues: [{ code: "MCP999", message: "informational" }],
					},
				}),
			}),
		);

		await expect(
			scanSkillDirectory("/tmp/skill", logger, {
				blockIssueCodes: ["MCP501"],
			}),
		).resolves.toBeUndefined();

		expect(logger.warn).toHaveBeenCalledWith(
			expect.stringContaining("MCP999"),
		);
	});

	it("parses JSON output when scanner emits extra log lines", async () => {
		const logger = createLogger();
		mockSpawn.mockReturnValue(
			createMockChildProcess({
				exitCode: 0,
				stdout:
					"scanner starting\n{\"/tmp/skill\":{\"issues\":[]}}\nscanner complete",
			}),
		);

		await expect(scanSkillDirectory("/tmp/skill", logger)).resolves.toBeUndefined();
	});

	it("fails when the scanner command exits non-zero", async () => {
		const logger = createLogger();
		mockSpawn.mockReturnValue(
			createMockChildProcess({
				exitCode: 2,
				stderr: "scan failed",
			}),
		);

		await expect(scanSkillDirectory("/tmp/skill", logger)).rejects.toThrow(
			/exit code 2: scan failed/,
		);
	});
});
