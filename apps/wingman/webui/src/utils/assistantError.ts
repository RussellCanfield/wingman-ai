export function appendAssistantErrorFeedback(
	content: string,
	errorText: string,
): string {
	const base = typeof content === "string" ? content : "";
	const normalizedError = errorText.trim();
	if (!normalizedError) return base;
	if (/cancel/i.test(normalizedError)) return base;

	const normalizedBase = base.trimEnd();
	if (!normalizedBase) return normalizedError;

	const feedbackLine = `Error: ${normalizedError}`;
	if (
		normalizedBase.includes(feedbackLine) ||
		normalizedBase.includes(normalizedError)
	) {
		return normalizedBase;
	}

	return `${normalizedBase}\n\n${feedbackLine}`;
}
