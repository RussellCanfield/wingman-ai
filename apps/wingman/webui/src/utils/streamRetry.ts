export type StreamMessageTransition = {
	nextActiveMessageId?: string;
	shouldResetBufferedText: boolean;
};

const normalizeStreamMessageId = (value?: string): string | undefined => {
	if (typeof value !== "string") return undefined;
	const normalized = value.trim();
	return normalized.length > 0 ? normalized : undefined;
};

export const resolveActiveStreamMessageId = (input: {
	currentActiveMessageId?: string;
	incomingMessageId?: string;
}): StreamMessageTransition => {
	const current = normalizeStreamMessageId(input.currentActiveMessageId);
	const incoming = normalizeStreamMessageId(input.incomingMessageId);

	if (!incoming) {
		return {
			nextActiveMessageId: current,
			shouldResetBufferedText: false,
		};
	}
	if (!current) {
		return {
			nextActiveMessageId: incoming,
			shouldResetBufferedText: false,
		};
	}
	if (current === incoming) {
		return {
			nextActiveMessageId: current,
			shouldResetBufferedText: false,
		};
	}

	return {
		nextActiveMessageId: incoming,
		shouldResetBufferedText: true,
	};
};
