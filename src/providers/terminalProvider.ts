import { exec, spawn, SpawnOptions } from "child_process";
import * as os from "os";

export class WingmanTerminal {
	private outputListeners: Set<
		(data: string, exitCode: number | null) => void
	> = new Set();
	private terminalProcess: ReturnType<typeof exec> | undefined;
	private stdoutData: string = "";
	private lastExitCode: number | null = null;

	constructor(
		private readonly cwd: string,
		private readonly terminalName: string = "Wingman Terminal"
	) {}

	public getLastExitCode(): number | null {
		return this.lastExitCode;
	}

	public spawn(): void {
		if (this.terminalProcess) {
			this.terminalProcess.kill();
		}

		const isWindows = os.platform() === "win32";
		const shellCommand = isWindows ? "cmd.exe" : "bash";

		const options: SpawnOptions = {
			cwd: this.cwd,
			env: { ...process.env },
		};

		this.terminalProcess = spawn(shellCommand, [], options);

		this.terminalProcess.stdout?.on("data", (data: Buffer) => {
			this.stdoutData += data.toString();
		});

		this.terminalProcess.stderr?.on("data", (data: Buffer) => {
			console.error(`Stderr: ${data.toString()}`);
		});

		this.terminalProcess.on("exit", (code: number | null) => {
			this.lastExitCode = code;
		});

		this.terminalProcess.on("close", (code: number | null) => {
			this.lastExitCode = this.lastExitCode || code;
			this.notifyListeners(this.stdoutData.trim(), this.lastExitCode);
			this.stdoutData = ""; // Reset for next command
		});

		this.terminalProcess.on("error", (error: Error) => {
			console.error(`Error: ${error.message}`);
			this.notifyListeners(`Error: ${error.message}`, null);
		});
	}

	public sendCommand(command: string): void {
		if (!this.terminalProcess) {
			this.spawn();
		}
		this.terminalProcess?.stdin?.write(`${command}\n`);
	}

	public subscribe(
		listener: (data: string, exitCode: number | null) => void
	): void {
		this.outputListeners.add(listener);
	}

	public unsubscribe(
		listener: (data: string, exitCode: number | null) => void
	): void {
		this.outputListeners.delete(listener);
	}

	private notifyListeners(data: string, exitCode: number | null): void {
		this.outputListeners.forEach((listener) => listener(data, exitCode));
	}

	public dispose(): void {
		if (this.terminalProcess) {
			this.terminalProcess.kill();
			this.terminalProcess = undefined;
		}
		this.outputListeners.clear();
	}
}
