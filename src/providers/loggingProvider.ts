import { ILoggingProvider } from "@shared/types/Logger";
import * as vscode from "vscode";

export class VSCodeLoggingProvider implements ILoggingProvider {
	private dbgChannel: vscode.OutputChannel;

	constructor() {
		this.dbgChannel = vscode.window.createOutputChannel("Wingman");
	}

	public logInfo(message: string): void {
		this.dbgChannel.appendLine(
			`${new Date().toLocaleString()} - [info] ${message}`
		);
	}

	public logError(
		messageOrError: string | Error | unknown,
		showErrorModal?: boolean
	): void {
		const message =
			typeof messageOrError === "string"
				? messageOrError
				: getErrorMessage(messageOrError);
		this.dbgChannel.appendLine(
			`${new Date().toLocaleString()} - [error] ${message}`
		);

		if (showErrorModal) {
			vscode.window.showErrorMessage(message);
		}
	}

	public dispose() {
		this.dbgChannel.dispose();
	}
}

function getErrorMessage(error: Error | unknown): string {
	if (error instanceof Error) {
		return error.message;
	} else if (typeof error === "string") {
		return error;
	} else {
		return "An unknown error occurred";
	}
}

const loggingProvider = new VSCodeLoggingProvider();
export { loggingProvider };
