import * as vscode from "vscode";

class LoggingProvider {
	dbgChannel: vscode.OutputChannel;

	constructor() {
		this.dbgChannel = vscode.window.createOutputChannel("Wingman");
	}

	public logInfo(message: string): void {
		this.dbgChannel.appendLine(
			`${new Date().toLocaleString()} - [info] ${message}`
		);
	}

	public logError(message: string): void {
		this.dbgChannel.appendLine(
			`${new Date().toLocaleString()} - [error] ${message}`
		);
	}
}

const loggingProvider = new LoggingProvider();
export { loggingProvider };
