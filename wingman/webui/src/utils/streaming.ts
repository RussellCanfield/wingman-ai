export type ParsedStreamEvent = {
	texts: string[];
	toolEvents: Array<{
		id: string;
		name: string;
		args?: Record<string, any>;
		status: "running" | "completed" | "error";
		output?: any;
		error?: string;
		timestamp: number;
	}>;
};

export function parseStreamEvents(chunk: any): ParsedStreamEvent {
	const texts: string[] = [];
	const toolEvents: ParsedStreamEvent["toolEvents"] = [];
	if (!chunk || typeof chunk !== "object") return { texts, toolEvents };

	if (typeof chunk.event === "string") {
		if (chunk.event === "on_chat_model_stream") {
			const messageChunk = chunk.data?.chunk || chunk.data?.message;
			const text = extractTextContent(messageChunk);
			if (text) texts.push(text);
			return { texts, toolEvents };
		}

		if (chunk.event === "on_llm_stream") {
			const llmChunk = chunk.data?.chunk;
			if (typeof llmChunk === "string") {
				texts.push(llmChunk);
			} else if (typeof llmChunk?.text === "string") {
				texts.push(llmChunk.text);
			}
			return { texts, toolEvents };
		}

		if (chunk.event === "on_tool_start") {
			const toolName = typeof chunk.name === "string" ? chunk.name : "tool";
			const toolId =
				typeof chunk.run_id === "string" ? chunk.run_id : createEventId();
			toolEvents.push({
				id: toolId,
				name: toolName,
				args: normalizeToolArgs(chunk.data?.input),
				status: "running",
				timestamp: Date.now(),
			});
			return { texts, toolEvents };
		}

		if (chunk.event === "on_tool_end") {
			const toolId = typeof chunk.run_id === "string" ? chunk.run_id : createEventId();
			toolEvents.push({
				id: toolId,
				name: typeof chunk.name === "string" ? chunk.name : "tool",
				status: chunk.data?.error ? "error" : "completed",
				output: chunk.data?.output,
				error: chunk.data?.error,
				timestamp: Date.now(),
			});
			return { texts, toolEvents };
		}
	}

	const messages: any[] = [];
	if (Array.isArray(chunk.messages)) {
		messages.push(...chunk.messages);
	}
	for (const value of Object.values(chunk)) {
		if (value && Array.isArray((value as any).messages)) {
			messages.push(...(value as any).messages);
		}
	}

	for (const message of messages) {
		const role =
			message?.role || message?.kwargs?.role || message?.additional_kwargs?.role;
		if (role === "user") continue;
		const text = extractTextContent(message);
		if (text) texts.push(text);

		const toolCalls = message?.tool_calls || message?.kwargs?.tool_calls;
		if (Array.isArray(toolCalls)) {
			for (const toolCall of toolCalls) {
				const normalized = normalizeToolCall(toolCall);
				if (!normalized) continue;
				toolEvents.push({
					id: normalized.id,
					name: normalized.name,
					args: normalized.args,
					status: "running",
					timestamp: Date.now(),
				});
			}
		}
	}

	if (typeof chunk.content === "string") {
		texts.push(chunk.content);
	}

	return { texts, toolEvents };
}

function extractTextContent(message: any): string {
	if (!message) return "";
	const content = message.content || message?.kwargs?.content || message?.additional_kwargs?.content;
	if (typeof content === "string") return content;
	if (Array.isArray(content)) {
		return content
			.filter((block: any) => block && block.type === "text" && block.text)
			.map((block: any) => block.text)
			.join("");
	}
	return "";
}

function createEventId(): string {
	if (typeof globalThis.crypto?.randomUUID === "function") {
		return globalThis.crypto.randomUUID();
	}
	return `evt-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function normalizeToolArgs(args: any): Record<string, any> {
	if (!args) return {};
	if (typeof args === "string") {
		try {
			const parsed = JSON.parse(args);
			if (parsed && typeof parsed === "object") {
				return parsed;
			}
		} catch {
			return { raw: args };
		}
		return { raw: args };
	}
	if (typeof args === "object") {
		return args as Record<string, any>;
	}
	return { value: args };
}

function normalizeToolCall(toolCall: any): { id: string; name: string; args: Record<string, any> } | null {
	if (!toolCall || typeof toolCall !== "object") return null;
	const name = toolCall.name || toolCall.function?.name;
	if (!name) return null;
	const id = toolCall.id || createEventId();
	const args = normalizeToolArgs(toolCall.args ?? toolCall.function?.arguments);
	return { id, name, args };
}
