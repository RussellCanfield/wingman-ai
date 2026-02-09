export function computeComposerTextareaLayout({
	scrollHeight,
	lineHeight,
	paddingTop,
	paddingBottom,
	maxLines,
}: {
	scrollHeight: number;
	lineHeight: number;
	paddingTop: number;
	paddingBottom: number;
	maxLines: number;
}): { heightPx: number; overflowY: "hidden" | "auto" } {
	const minHeight = lineHeight + paddingTop + paddingBottom;
	const maxHeight = lineHeight * maxLines + paddingTop + paddingBottom;
	const heightPx = Math.min(Math.max(scrollHeight, minHeight), maxHeight);
	return {
		heightPx,
		overflowY: scrollHeight > maxHeight ? "auto" : "hidden",
	};
}

export function shouldRefocusComposer({
	wasStreaming,
	isStreaming,
}: {
	wasStreaming: boolean;
	isStreaming: boolean;
}): boolean {
	return wasStreaming && !isStreaming;
}
