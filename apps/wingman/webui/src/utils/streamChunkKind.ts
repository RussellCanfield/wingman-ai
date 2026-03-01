export function isAssistantTextStreamChunk(chunk: unknown): boolean {
	if (!chunk || typeof chunk !== "object") return false;
	const event = (chunk as { event?: unknown }).event;
	return (
		event === "on_chat_model_stream" ||
		event === "on_chain_stream" ||
		event === "on_chain_end"
	);
}
