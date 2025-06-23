import type { ILoggingProvider } from "@shared/types/Logger";

export class ConsoleLoggingProvider implements ILoggingProvider {
	public logInfo(message: string): void {
		console.log(`${new Date().toLocaleString()} - [info] ${message}`);
	}

	public logError(messageOrError: string | Error | unknown): void {
		const message =
			typeof messageOrError === "string"
				? messageOrError
				: getErrorMessage(messageOrError);
		console.error(`${new Date().toLocaleString()} - [error] ${message}`);
	}

	public dispose() {
		// No need to dispose anything for console logging
	}
}

function getErrorMessage(error: Error | unknown): string {
	if (error instanceof Error) {
		return error.message;
	}

	if (typeof error === "string") {
		return error;
	}

	return "An unknown error occurred";
}

const loggingProvider = new ConsoleLoggingProvider();
export { loggingProvider };
