import * as vscode from "vscode";

/**
 * Monitors file save events in the workspace
 * @param callback Function to execute when a file is saved
 * @returns Disposable that can be used to stop monitoring
 */
export function monitorFileSaves(
	callback: (document: vscode.TextDocument) => void,
): vscode.Disposable {
	// Create a disposable event listener for file save events
	const disposable = vscode.workspace.onDidSaveTextDocument((document) => {
		// Only process file scheme documents (ignore virtual documents)
		if (document.uri.scheme === "file") {
			// Call the provided callback with the saved document
			callback(document);
		}
	});

	return disposable;
}
