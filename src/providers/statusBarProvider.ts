import * as vscode from "vscode";
import { eventEmitter } from "../events/eventEmitter";

export class ActivityStatusBar {
	activityStatusBarItem: vscode.StatusBarItem;

	public readonly onQueryStart: vscode.Event<void> =
		eventEmitter._onQueryStart.event;

	public readonly onQueryComplete: vscode.Event<void> =
		eventEmitter._onQueryComplete.event;

	constructor() {
		this.activityStatusBarItem = vscode.window.createStatusBarItem(
			vscode.StatusBarAlignment.Right,
			100
		);

		this.activityStatusBarItem.text = `$(wingman-logo) Wingman`;
		this.activityStatusBarItem.show();

		this.onQueryStart(() => {
			this.TogglePending(true);
		});

		this.onQueryComplete(() => {
			this.TogglePending(false);
		});
	}

	public TogglePending(pending: boolean) {
		this.activityStatusBarItem.text = `${
			pending ? "$(sync~spin)" : "$(wingman-logo)"
		} Wingman`;
	}

	dispose() {
		this.activityStatusBarItem?.dispose();
	}
}
