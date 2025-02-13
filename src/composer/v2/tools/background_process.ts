import { DynamicStructuredTool } from "@langchain/core/tools";
import { spawn, ChildProcess } from "node:child_process";
import { z } from "zod";
import { createConnection } from "net";
import { promisify } from "util";

class ProcessManager {
    private static instance: ProcessManager;
    private processes: Map<string, ChildProcess> = new Map();

    private constructor() { }

    static getInstance(): ProcessManager {
        if (!ProcessManager.instance) {
            ProcessManager.instance = new ProcessManager();
        }
        return ProcessManager.instance;
    }

    async startProcess(name: string, command: string, cwd: string, env: Record<string, any>): Promise<number> {
        // Cleanup existing process if it exists
        if (this.processes.has(name)) {
            await this.killProcess(name);
        }

        const child = spawn(command, {
            shell: true,
            cwd,
            env: { ...process.env, ...env },
            detached: true,
            stdio: 'ignore'
        });

        this.processes.set(name, child);
        child.unref();

        return child.pid!;
    }

    async killProcess(name: string): Promise<void> {
        const process = this.processes.get(name);
        if (process) {
            try {
                process.kill('SIGTERM');
                // Give it a moment to terminate gracefully
                await promisify(setTimeout)(1000);
                // Force kill if still running
                if (!process.killed) {
                    process.kill('SIGKILL');
                }
            } catch (error) {
                console.error(`Failed to kill process ${name}:`, error);
            }
            this.processes.delete(name);
        }
    }

    async cleanup(): Promise<void> {
        const names = Array.from(this.processes.keys());
        await Promise.all(names.map(name => this.killProcess(name)));
    }
}

interface WaitForPortOptions {
    timeout?: number;
    retryInterval?: number;
    host?: string;
}

export const waitForPort = async (
    port: number,
    options: WaitForPortOptions = {}
): Promise<void> => {
    const {
        timeout = 30000,
        retryInterval = 1000,
        host = 'localhost'
    } = options;

    const startTime = Date.now();

    const tryConnect = (): Promise<boolean> => {
        return new Promise((resolve) => {
            const socket = createConnection(port, host)
                .on('connect', () => {
                    socket.destroy();
                    resolve(true);
                })
                .on('error', () => {
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
        `Timeout waiting for port ${port} on ${host} after ${timeout}ms`
    );
};

export const createBackgroundProcessTool = (workspace: string, env: Record<string, any> = {}) => {
    const processManager = ProcessManager.getInstance();

    return new DynamicStructuredTool({
        name: "background_process",
        description: "Starts a long-running process in the background if port is not already in use",
        schema: z.object({
            command: z.string().describe("The command to execute"),
            port: z.number().describe("The network port to listen for"),
            name: z.string().describe("Unique identifier for the process")
        }),
        func: async ({ command, port, name }) => {
            try {
                // Check if port is already available
                try {
                    await waitForPort(port, { timeout: 3000 }); // Quick check
                    return `Port ${port} is already in use, assuming service is running`;
                } catch {
                    // Port not available, proceed with starting process
                    const pid = await processManager.startProcess(name, command, workspace, env);

                    // Wait for port to become available
                    await waitForPort(port, { timeout: 60000 });
                    return `Process '${name}' started with PID ${pid}`;
                }
            } catch (error) {
                // Cleanup on failure
                await processManager.killProcess(name);
                if (error instanceof Error) {
                    throw new Error(`Failed to start process '${name}': ${error.message}`);
                }
                throw error;
            }
        }
    });
};

// Cleanup helper for the extension/application lifecycle
export const cleanupProcesses = async () => {
    await ProcessManager.getInstance().cleanup();
};