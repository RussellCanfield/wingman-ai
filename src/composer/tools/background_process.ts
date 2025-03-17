import { tool } from "@langchain/core/tools";
import { spawn, type ChildProcess, type SpawnOptions, type StdioOptions } from "node:child_process";
import { z } from "zod";
import { createConnection } from "node:net";
import { promisify } from "node:util";
import { baseToolSchema } from "./schemas";

class ProcessManager {
	private static instance: ProcessManager;
	private processes: Map<string, ChildProcess> = new Map();

	private constructor() {}

	static getInstance(): ProcessManager {
		if (!ProcessManager.instance) {
			ProcessManager.instance = new ProcessManager();
		}
		return ProcessManager.instance;
	}

	async startProcess(
		name: string,
		command: string,
		cwd: string,
		env: Record<string, any>,
		captureOutput = false,
	): Promise<{ pid: number; output?: string }> {
		// Cleanup existing process if it exists
		if (this.processes.has(name)) {
			await this.killProcess(name);
		}

		// Configure stdio based on whether we want to capture output
		const stdio: StdioOptions = captureOutput ? ["ignore", "pipe", "pipe"] : "ignore";

		const options: SpawnOptions = {
			shell: true,
			cwd,
			env: { ...process.env, ...env },
			detached: true,
			stdio,
		};

		const child = spawn(command, options);

		this.processes.set(name, child);
		
		// Only unref if we're not capturing output
		if (!captureOutput && child.unref) {
			child.unref();
		}

		// If we're not capturing output, just return the PID
		if (!captureOutput) {
			return { pid: child.pid ?? 0 };
		}

		// If we are capturing output, collect it for a short time
		const stdoutChunks: Buffer[] = [];
		const stderrChunks: Buffer[] = [];

		if (child.stdout) {
			child.stdout.on("data", (chunk: Buffer) => {
				stdoutChunks.push(Buffer.from(chunk));
			});
		}

		if (child.stderr) {
			child.stderr.on("data", (chunk: Buffer) => {
				stderrChunks.push(Buffer.from(chunk));
			});
		}

		// After collecting output, we'll still keep the process running in the background
		if (child.unref) {
			child.unref();
		}

		return { pid: child.pid ?? 0 };
	}

	async captureInitialOutput(
		name: string,
		captureTimeMs = 10000,
	): Promise<string> {
		const process = this.processes.get(name);
		if (!process || !process.stdout || !process.stderr) {
			return "No output available (process may not have stdio pipes attached)";
		}

		const stdoutChunks: Buffer[] = [];
		const stderrChunks: Buffer[] = [];

		// Set up data collection
		const stdoutHandler = (chunk: Buffer) => {
			stdoutChunks.push(chunk);
		};
		
		const stderrHandler = (chunk: Buffer) => {
			stderrChunks.push(chunk);
		};

		process.stdout.on("data", stdoutHandler);
		process.stderr.on("data", stderrHandler);

		// Wait for the specified time to collect output
		await promisify(setTimeout)(captureTimeMs);

		// Remove listeners to avoid memory leaks
		process.stdout.removeListener("data", stdoutHandler);
		process.stderr.removeListener("data", stderrHandler);

		// Combine the collected output
		const stdout = Buffer.concat(stdoutChunks).toString().trim();
		const stderr = Buffer.concat(stderrChunks).toString().trim();

		let output = "";
		if (stdout) {
			output += `STDOUT:\n${stdout}\n`;
		}
		if (stderr) {
			output += `${output ? "\n" : ""}STDERR:\n${stderr}`;
		}

		return output || "No output captured during the initial execution period";
	}

	async killProcess(name: string): Promise<void> {
		const process = this.processes.get(name);
		if (process) {
			try {
				process.kill("SIGTERM");
				// Give it a moment to terminate gracefully
				await promisify(setTimeout)(1000);
				// Force kill if still running
				if (!process.killed) {
					process.kill("SIGKILL");
				}
			} catch (error) {
				console.error(`Failed to kill process ${name}:`, error);
			}
			this.processes.delete(name);
		}
	}

	async cleanup(): Promise<void> {
		const names = Array.from(this.processes.keys());
		await Promise.all(names.map((name) => this.killProcess(name)));
	}
}

interface WaitForPortOptions {
	timeout?: number;
	retryInterval?: number;
	host?: string;
}

export const waitForPort = async (
	port: number,
	options: WaitForPortOptions = {},
): Promise<void> => {
	const { timeout = 30000, retryInterval = 1000, host = "localhost" } = options;

	const startTime = Date.now();

	const tryConnect = (): Promise<boolean> => {
		return new Promise((resolve) => {
			const socket = createConnection(port, host)
				.on("connect", () => {
					socket.destroy();
					resolve(true);
				})
				.on("error", () => {
					socket.destroy();
					resolve(false);
				});
		});
	};

	while (Date.now() - startTime < timeout) {
		const isAvailable = await tryConnect();
		if (isAvailable) {
			return;
		}
		await promisify(setTimeout)(retryInterval);
	}

	throw new Error(
		`Timeout waiting for port ${port} on ${host} after ${timeout}ms`,
	);
};

export const backgroundProcessSchema = baseToolSchema.extend({
	command: z.string().describe("The command to execute"),
	port: z.number().describe("The network port to listen for"),
	name: z.string().describe("Unique identifier for the process"),
	captureOutput: z.boolean().optional().describe("Whether to capture and return initial command output"),
	captureTimeMs: z.number().optional().describe("How long to capture output for (in milliseconds)"),
});

/**
 * Creates a tool that starts a long-running process in the background
 */
export const createBackgroundProcessTool = (
	workspace: string,
	env: Record<string, any> = {},
) => {
	const processManager = ProcessManager.getInstance();

	return tool(
		async (input) => {
			try {
				// Extract optional parameters with defaults
				const captureOutput = input.captureOutput ?? true; // Default to capturing output
				const captureTimeMs = input.captureTimeMs ?? 10000; // Default to 10 seconds

				// Check if port is already available
				try {
					await waitForPort(input.port, { timeout: 3000 }); // Quick check
					return `Port ${input.port} is already in use, assuming service is running`;
				} catch {
					// Port not available, proceed with starting process
					const { pid } = await processManager.startProcess(
						input.name,
						input.command,
						workspace,
						env,
						captureOutput,
					);

					// Start capturing output in parallel with waiting for the port
					const outputPromise = captureOutput 
						? processManager.captureInitialOutput(input.name, captureTimeMs)
						: Promise.resolve("");

					// Wait for port to become available
					const portPromise = waitForPort(input.port, { timeout: 60000 });
					
					// Wait for both operations to complete
					const [output] = await Promise.all([outputPromise, portPromise]);

					// Return both the process info and any captured output
					if (output) {
						return `Process '${input.name}' started with PID ${pid}\n\nInitial Output (${captureTimeMs/1000}s):\n${output}`;
					}
					
					return `Process '${input.name}' started with PID ${pid}`;
				}
			} catch (error) {
				// Cleanup on failure
				await processManager.killProcess(input.name);
				if (error instanceof Error) {
					throw new Error(
						`Failed to start process '${input.name}': ${error.message}`,
					);
				}
				throw error;
			}
		},
		{
			name: "background_process",
			description:
				"Starts a long-running process in the background if port is not already in use. Captures initial output for a short period. Use this tool for dev servers or monitoring a terminal command that may not immediately exit.",
			schema: backgroundProcessSchema,
		},
	);
};

// Cleanup helper for the extension/application lifecycle
export const cleanupProcesses = async () => {
	await ProcessManager.getInstance().cleanup();
};