import {
	existsSync,
	mkdtempSync,
	rmSync,
	writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { GatewayConfig } from "@/gateway/types.js";

const daemonStartMock = vi.fn(async (_config: GatewayConfig) => {});
const daemonStopMock = vi.fn(async () => {});
const daemonRestartMock = vi.fn(async () => {});
const daemonGetStatusMock = vi.fn(() => ({ running: false }));
const daemonGetLogFileMock = vi.fn(() => "/tmp/wingman-gateway.log");
const daemonGetPidFileMock = vi.fn(() => "/tmp/wingman-gateway.pid");
const daemonGetConfigFileMock = vi.fn(() => "/tmp/wingman-gateway.json");

let serverStartShouldReject = false;
const createdServerConfigs: GatewayConfig[] = [];
const serverStartMock = vi.fn(async () => {
	if (serverStartShouldReject) {
		throw new Error("synthetic gateway run stop");
	}
});
const serverStopMock = vi.fn(async () => {});

const loadConfigMock = vi.fn(() => ({
	gateway: {
		host: "127.0.0.1",
		port: 18789,
		auth: { mode: "none" as const },
	},
}));

vi.mock("../gateway/index.js", () => ({
	GatewayDaemon: class {
		start = daemonStartMock;
		stop = daemonStopMock;
		restart = daemonRestartMock;
		getStatus = daemonGetStatusMock;
		getLogFile = daemonGetLogFileMock;
		getPidFile = daemonGetPidFileMock;
		getConfigFile = daemonGetConfigFileMock;
	},
	GatewayServer: class {
		constructor(config: GatewayConfig) {
			createdServerConfigs.push(config);
		}
		start = serverStartMock;
		stop = serverStopMock;
	},
	GatewayClient: class {},
}));

vi.mock("../cli/config/loader.js", () => ({
	WingmanConfigLoader: class {
		loadConfig = loadConfigMock;
	},
}));

import { executeGatewayCommand } from "@/cli/commands/gateway.js";

describe("gateway command workspace handling", () => {
	let tempRoot: string;
	let consoleLogSpy: ReturnType<typeof vi.spyOn>;
	let consoleErrorSpy: ReturnType<typeof vi.spyOn>;
	let processExitSpy: ReturnType<typeof vi.spyOn>;
	const originalGatewayConfigEnv = process.env.WINGMAN_GATEWAY_CONFIG;

	beforeEach(() => {
		tempRoot = mkdtempSync(join(tmpdir(), "wingman-gateway-command-"));
		serverStartShouldReject = false;
		createdServerConfigs.length = 0;
		daemonStartMock.mockClear();
		serverStartMock.mockClear();
		loadConfigMock.mockClear();
		consoleLogSpy = vi.spyOn(console, "log").mockImplementation(() => {});
		consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
		processExitSpy = vi.spyOn(process, "exit").mockImplementation(((
			code?: number,
		) => {
			throw new Error(`process.exit(${code ?? "undefined"})`);
		}) as never);
		delete process.env.WINGMAN_GATEWAY_CONFIG;
	});

	afterEach(() => {
		consoleLogSpy.mockRestore();
		consoleErrorSpy.mockRestore();
		processExitSpy.mockRestore();
		if (originalGatewayConfigEnv) {
			process.env.WINGMAN_GATEWAY_CONFIG = originalGatewayConfigEnv;
		} else {
			delete process.env.WINGMAN_GATEWAY_CONFIG;
		}
		if (existsSync(tempRoot)) {
			rmSync(tempRoot, { recursive: true, force: true });
		}
	});

	it("passes workspace/configDir into daemon config on gateway start", async () => {
		const workspace = join(tempRoot, "workspace");
		const configDir = ".wingman-dev";

		await executeGatewayCommand(
			{
				subcommand: "start",
				args: [],
				options: {},
			},
			{ workspace, configDir },
		);

		expect(daemonStartMock).toHaveBeenCalledTimes(1);
		expect(daemonStartMock).toHaveBeenCalledWith(
			expect.objectContaining({
				workspace,
				configDir,
			}),
		);
	});

	it("fills missing workspace/configDir when running from daemon config", async () => {
		const workspace = join(tempRoot, "workspace");
		const configDir = ".wingman-dev";
		const daemonConfigPath = join(tempRoot, "gateway-daemon.json");
		writeFileSync(
			daemonConfigPath,
			JSON.stringify({
				host: "127.0.0.1",
				port: 18789,
				auth: { mode: "none" },
			}),
		);
		process.env.WINGMAN_GATEWAY_CONFIG = daemonConfigPath;
		serverStartShouldReject = true;

		await expect(
			executeGatewayCommand(
				{
					subcommand: "run",
					args: [],
					options: { daemon: true },
				},
				{ workspace, configDir },
			),
		).rejects.toThrow("process.exit(1)");

		expect(createdServerConfigs).toHaveLength(1);
		expect(createdServerConfigs[0]?.workspace).toBe(workspace);
		expect(createdServerConfigs[0]?.configDir).toBe(configDir);
	});
});
