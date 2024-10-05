import { exec, spawn, SpawnOptions, ChildProcess } from "child_process";
import * as os from "os";

export const CustomTimeoutExitCode = 124;

export class WingmanTerminal {
	private outputListeners: Set<
		(data: string, exitCode: number | undefined) => void
	> = new Set();
	private terminalProcess: ChildProcess | undefined;
	private stdoutData: string = "";
	private stderrData: string = "";
	private lastExitCode: number | undefined;

	constructor(
		private readonly cwd: string,
		private readonly terminalName: string = "Wingman Terminal"
	) {}

	public getLastExitCode(): number | undefined {
		return this.lastExitCode;
	}

	private flushOutput(): void {
		const output =
			this.stdoutData.trim() +
			(this.stderrData ? `\nErrors:\n${this.stderrData.trim()}` : "");
		this.notifyListeners(output, this.lastExitCode);
		this.stdoutData = "";
		this.stderrData = "";
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
			shell: true,
		};

		this.terminalProcess = spawn(shellCommand, [], options);

		this.terminalProcess.stdout?.on("data", (data: Buffer) => {
			this.stdoutData += data.toString();
		});

		this.terminalProcess.stderr?.on("data", (data: Buffer) => {
			this.stderrData += data.toString();
		});

		this.terminalProcess.on("exit", (code: number | undefined) => {
			this.lastExitCode = code;
		});

		this.terminalProcess.on("close", () => {
			this.flushOutput();
		});

		this.terminalProcess.on("error", (error: Error) => {
			this.stderrData += `Error: ${error.message}\n`;
			this.lastExitCode = 1;
			this.flushOutput();
		});
	}

	public async sendCommand(command: string, timeout = 60000): Promise<void> {
		return new Promise<void>((resolve, reject) => {
			exec(command, { cwd: this.cwd }, (error, stdout, stderr) => {
				this.stdoutData = stdout;
				this.stderrData = stderr;
				this.lastExitCode = error ? error.code : 0;
				this.flushOutput();
				resolve();
			});

			// Implement timeout
			setTimeout(() => {
				if (this.lastExitCode === null) {
					this.lastExitCode = CustomTimeoutExitCode; // Using 124 as a custom timeout exit code
					this.stderrData += "Command timed out\n";
					this.flushOutput();
					resolve();
				}
			}, timeout);
		});
	}

	public subscribe(
		listener: (data: string, exitCode: number | undefined) => void
	): void {
		this.outputListeners.add(listener);
	}

	public unsubscribe(
		listener: (data: string, exitCode: number | undefined) => void
	): void {
		this.outputListeners.delete(listener);
	}

	private notifyListeners(data: string, exitCode: number | undefined): void {
		this.outputListeners.forEach((listener) => listener(data, exitCode));
	}

	public cancel(): void {
		if (this.terminalProcess) {
			this.terminalProcess.kill();
			this.terminalProcess = undefined;
		}
	}
}
