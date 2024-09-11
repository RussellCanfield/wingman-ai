import { TextDocument, Position } from "vscode";

export const getContentWindow = (
	document: TextDocument,
	position: Position,
	window: number
) => {
	let prefix: string = "";
	let suffix: string = "";
	const length = window;
	let tokenCount = 0;
	const text = document.getText();
	let current = document.offsetAt(position);
	let top = current;
	let bottom = current;

	// every 3 chars we add a new token to the token count
	let letCurrentChatToTokenCount = 0;
	while (tokenCount < length && (top > -1 || bottom < text.length)) {
		if (top > -1) {
			letCurrentChatToTokenCount++;
			top--;
		}

		if (letCurrentChatToTokenCount === 3) {
			tokenCount++;
			letCurrentChatToTokenCount = 0;
		}

		if (bottom < text.length) {
			letCurrentChatToTokenCount++;
			bottom++;
		}

		if (letCurrentChatToTokenCount === 3) {
			tokenCount++;
			letCurrentChatToTokenCount = 0;
		}
	}
	prefix = text.substring(top, current);
	suffix = text.substring(current, bottom);
	return [prefix, suffix];
};

export const truncateChatHistory = (
	maxRecords: number,
	chatHistory: unknown[]
) => {
	// Ensure there are more than maxRecords + 1 entries to require truncation
	if (chatHistory.length > maxRecords + 1) {
		// Keep the first entry, up to maxRecords entries after the first, and the last entry
		// Calculate start index for slicing after the first entry
		const startIndex = Math.max(1, chatHistory.length - maxRecords - 1);
		// Slice chatHistory to keep the first entry, and then the last maxRecords entries
		chatHistory = [
			chatHistory[0],
			...chatHistory.slice(startIndex, -1),
			chatHistory[chatHistory.length - 1],
		];
	}
};
