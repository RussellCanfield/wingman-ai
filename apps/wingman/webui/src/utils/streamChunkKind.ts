export function isAssistantTextStreamChunk(chunk: unknown): boolean {
	if (!chunk || typeof chunk !== "object") return false;
	return (chunk as { event?: unknown }).event === "on_chat_model_stream";
}
