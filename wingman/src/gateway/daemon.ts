import { spawn } from "child_process";
import { existsSync, readFileSync, writeFileSync, unlinkSync } from "fs";
import { join } from "path";
import { homedir } from "os";
import type { GatewayConfig, DaemonStatus } from "./types.js";

/**
 * Daemon manager for running the gateway in the background
 */
export class GatewayDaemon {
	private pidFile: string;
	private logFile: string;
	private configFile: string;

	constructor() {
		const wingmanDir = join(homedir(), ".wingman");
		this.pidFile = join(wingmanDir, "gateway.pid");
		this.logFile = join(wingmanDir, "gateway.log");
		this.configFile = join(wingmanDir, "gateway.json");
	}

	/**
	 * Start the gateway as a daemon
	 */
	async start(config: GatewayConfig): Promise<void> {
		// Check if already running
		if (this.isRunning()) {
			throw new Error("Gateway is already running");
		}

		// Save config
		this.saveConfig(config);

		// Get the path to the current script
		const scriptPath = process.argv[1];

		// Spawn the daemon process
		const child = spawn(
			process.execPath,
			[scriptPath, "gateway", "run", "--daemon"],
			{
				detached: true,
				stdio: ["ignore", "pipe", "pipe"],
				env: {
					...process.env,
					WINGMAN_GATEWAY_CONFIG: this.configFile,
				},
			},
		);

		// Write PID file
		writeFileSync(this.pidFile, child.pid!.toString());

		// Redirect output to log file
		const logStream = Bun.file(this.logFile).writer();
		child.stdout?.on("data", (data) => {
			logStream.write(data);
		});
		child.stderr?.on("data", (data) => {
			logStream.write(data);
		});

		// Unref the child process so parent can exit
		child.unref();

		console.log(`Gateway daemon started with PID ${child.pid}`);
		console.log(`Logs: ${this.logFile}`);
	}

	/**
	 * Stop the gateway daemon
	 */
	async stop(): Promise<void> {
		if (!this.isRunning()) {
			throw new Error("Gateway is not running");
		}

		const pid = this.getPid();
		if (!pid) {
			throw new Error("Could not read PID file");
		}

		try {
			// Send SIGTERM to gracefully shutdown
			process.kill(pid, "SIGTERM");

			// Wait a bit for graceful shutdown
			await new Promise((resolve) => setTimeout(resolve, 2000));

			// If still running, force kill
			if (this.isProcessRunning(pid)) {
				process.kill(pid, "SIGKILL");
			}

			// Remove PID file
			this.removePidFile();

			console.log("Gateway daemon stopped");
		} catch (error) {
			// Process might already be dead
			this.removePidFile();
			throw error;
		}
	}

	/**
	 * Restart the gateway daemon
	 */
	async restart(): Promise<void> {
		const config = this.loadConfig();
		if (!config) {
			throw new Error("No saved configuration found");
		}

		if (this.isRunning()) {
			await this.stop();
		}

		await this.start(config);
	}

	/**
	 * Get the status of the gateway daemon
	 */
	getStatus(): DaemonStatus {
		const running = this.isRunning();
		const pid = this.getPid();
		const config = this.loadConfig();

		if (!running) {
			return { running: false };
		}

		const uptime = pid ? this.getProcessUptime(pid) : undefined;

		return {
			running: true,
			pid,
			uptime,
			config,
		};
	}

	/**
	 * Check if the gateway is running
	 */
	isRunning(): boolean {
		const pid = this.getPid();
		if (!pid) {
			return false;
		}

		return this.isProcessRunning(pid);
	}

	/**
	 * Get the PID from the PID file
	 */
	private getPid(): number | undefined {
		if (!existsSync(this.pidFile)) {
			return undefined;
		}

		try {
			const pidStr = readFileSync(this.pidFile, "utf-8").trim();
			return parseInt(pidStr, 10);
		} catch (error) {
			return undefined;
		}
	}

	/**
	 * Check if a process is running
	 */
	private isProcessRunning(pid: number): boolean {
		try {
			// Sending signal 0 checks if process exists without killing it
			process.kill(pid, 0);
			return true;
		} catch (error) {
			return false;
		}
	}

	/**
	 * Get process uptime in milliseconds
	 */
	private getProcessUptime(pid: number): number | undefined {
		try {
			// This is a simple implementation
			// On Unix systems, you could read /proc/[pid]/stat for more accurate uptime
			const stats = readFileSync(this.pidFile, "utf-8");
			const pidFileStats = Bun.file(this.pidFile);
			// Return time since PID file was created as approximation
			return Date.now() - pidFileStats.lastModified;
		} catch (error) {
			return undefined;
		}
	}

	/**
	 * Remove the PID file
	 */
	private removePidFile(): void {
		if (existsSync(this.pidFile)) {
			unlinkSync(this.pidFile);
		}
	}

	/**
	 * Save gateway configuration
	 */
	private saveConfig(config: GatewayConfig): void {
		writeFileSync(this.configFile, JSON.stringify(config, null, 2));
	}

	/**
	 * Load gateway configuration
	 */
	private loadConfig(): GatewayConfig | undefined {
		if (!existsSync(this.configFile)) {
			return;
		}

		try {
			const configStr = readFileSync(this.configFile, "utf-8");
			return JSON.parse(configStr);
		} catch (error) {
			return;
		}
	}

	/**
	 * Get the log file path
	 */
	getLogFile(): string {
		return this.logFile;
	}

	/**
	 * Get the PID file path
	 */
	getPidFile(): string {
		return this.pidFile;
	}

	/**
	 * Get the config file path
	 */
	getConfigFile(): string {
		return this.configFile;
	}
}
