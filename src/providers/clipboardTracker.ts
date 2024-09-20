import * as vscode from "vscode";

let clipboardHistory: string[] = [];
const clipboardHistoryLimit = 3;
let lastClipboardContent: string | undefined;

export function startClipboardTracking() {
	setInterval(async () => {
		const clipboardContent = await vscode.env.clipboard.readText();
		if (clipboardContent && clipboardContent !== lastClipboardContent) {
			lastClipboardContent = clipboardContent;
			clipboardHistory.unshift(clipboardContent);
			if (clipboardHistory.length > clipboardHistoryLimit) {
				clipboardHistory.pop();
			}
		}
	}, 1000).unref();
}

export function getClipboardHistory() {
	let totalLength = clipboardHistory.reduce(
		(acc, entry) => acc + entry.length,
		0
	);

	while (totalLength > 1000 && clipboardHistory.length > 0) {
		const removedEntry = clipboardHistory.pop();
		if (removedEntry) {
			totalLength -= removedEntry.length;
		}
	}

	return clipboardHistory;
}
