import { spawn } from "node:child_process";
import { once } from "node:events";

export interface CommandExecutionOptions {
	cwd: string;
	timeoutMs: number;
	env?: Record<string, string>;
	shell?: boolean;
}

export interface CommandExecutionResult {
	exitCode: number;
	timedOut: boolean;
	durationMs: number;
	stdout: string;
	stderr: string;
}

export async function runCommand(
	command: string,
	args: string[],
	options: CommandExecutionOptions,
): Promise<CommandExecutionResult> {
	const startedAt = Date.now();
	const child = spawn(command, args, {
		cwd: options.cwd,
		env: { ...process.env, ...(options.env || {}) },
		shell: options.shell === true,
		stdio: ["ignore", "pipe", "pipe"],
	});

	let stdout = "";
	let stderr = "";

	child.stdout?.on("data", (chunk: Buffer | string) => {
		stdout += chunk.toString();
	});
	child.stderr?.on("data", (chunk: Buffer | string) => {
		stderr += chunk.toString();
	});

	let timedOut = false;
	const timer = setTimeout(() => {
		timedOut = true;
		child.kill("SIGTERM");
		setTimeout(() => {
			if (!child.killed) {
				child.kill("SIGKILL");
			}
		}, 500);
	}, options.timeoutMs);

	const [code] = (await once(child, "close")) as [number | null];
	clearTimeout(timer);

	return {
		exitCode: code ?? 1,
		timedOut,
		durationMs: Date.now() - startedAt,
		stdout,
		stderr,
	};
}
