import * as vscode from "vscode";

class EventEmitter {
	public _onFatalError: vscode.EventEmitter<void> =
		new vscode.EventEmitter<void>();
	public _onQueryStart: vscode.EventEmitter<void> =
		new vscode.EventEmitter<void>();
	public _onQueryComplete: vscode.EventEmitter<void> =
		new vscode.EventEmitter<void>();
}

const eventEmitter = new EventEmitter();
export { eventEmitter };
