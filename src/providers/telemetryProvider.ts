import * as vscode from "vscode";
import TelemetryReporter, {
	type TelemetryEventProperties,
} from "@vscode/extension-telemetry";

export const EVENT_EXTENSION_LOADED = "EXTENSION_LOADED";
export const EVENT_AI_PROVIDER_VALIDATION_FAILED =
	"AI_PROVIDER_VALIDATION_FAILED";
export const EVENT_VECTOR_STORE_LOAD_FAILED = "VECTOR_STORE_LOAD_FAILED";
export const EVENT_COMPOSE_STARTED = "COMPOSE_STARTED";
export const EVENT_COMPOSE_PHASE = "COMPOSE_PHASE";
export const EVENT_FULL_INDEX_BUILD = "INDEX_BUILD_STARTED";
export const EVENT_VALIDATE_SUCCEEDED = "VALIDATE_SUCCEEDED";
export const EVENT_VALIDATE_FAILED = "VALIDATE_FAILED";
export const EVENT_CHAT_SENT = "CHAT_SENT";
export const EVENT_CODE_COMPLETE_CACHE = "CODE_COMPLETE_CACHE";
export const EVENT_CODE_COMPLETE = "CODE_COMPLETE_SENT";
export const EVENT_CODE_COMPLETE_HOTKEY = "CODE_COMPLETE_HOTKEY";
export const EVENT_DOC_GEN = "DOC_GEN";
export const EVENT_REFACTOR = "REFACTOR";
export const EVENT_REVIEW_STARTED = "CODE_REVIEW";
export const EVENT_REVIEW_FILE_BY_FILE = "CODE_REVIEW_FILES";
export const EVENT_COMMIT_MSG = "COMMIT_MSG";
export const EVENT_BINDINGS_FAILED = "BINDINGS_FAILED";

export class Telemetry {
	reporter: TelemetryReporter | undefined;

	private enabled = false;
	private disposables: vscode.Disposable[] = [];

	constructor() {
		this.enabled = vscode.env.isTelemetryEnabled;
		const connectionString = process.env.PUBLIC_TELEMETRY_CONNECTIONSTRING;

		if (connectionString) {
			this.reporter = new TelemetryReporter(connectionString);
			this.disposables.push(this.reporter);
		}

		this.disposables.push(
			vscode.env.onDidChangeTelemetryEnabled((e) => {
				this.enabled = e.valueOf();
			}),
		);
	}

	public dispose() {
		if (!this.disposables) return;

		for (const dispoable of this.disposables) {
			dispoable.dispose();
		}
	}

	public sendEvent(
		eventName: string,
		eventPropeties?: TelemetryEventProperties,
	) {
		if (!this.enabled) return;

		this.reporter?.sendTelemetryEvent(eventName, eventPropeties);
	}

	public sendError(
		eventName: string,
		eventPropeties?: TelemetryEventProperties,
	) {
		if (!this.enabled) return;

		this.reporter?.sendTelemetryErrorEvent(eventName, eventPropeties);
	}
}

const telemetry = new Telemetry();
export { telemetry };
