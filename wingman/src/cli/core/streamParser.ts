/**
 * Parse LangGraph streaming chunks for display
 *
 * LangGraph/DeepAgents streams chunks in various formats:
 * - AIMessage updates with content deltas
 * - Tool calls
 * - State updates
 *
 * This parser extracts displayable text for CLI output.
 */

export interface ParsedChunk {
	text?: string;
	toolCall?: {
		name: string;
		args?: any;
	};
	type: "text" | "tool" | "state" | "unknown";
}

/**
 * Parse a raw LangGraph stream chunk
 */
export function parseStreamChunk(chunk: any): ParsedChunk | null {
	if (!chunk || typeof chunk !== "object") {
		return null;
	}

	// Only process model_request chunks - these contain the actual AI response
	// Skip middleware hooks (before_agent, after_model, etc.)
	const chunkKeys = Object.keys(chunk);
	const isModelResponse = chunkKeys.some(
		(key) => key === "model_request" || key === "agent" || key === "__end__",
	);

	if (!isModelResponse) {
		return null;
	}

	// Get messages from the appropriate key
	let messages = chunk.model_request?.messages || chunk.agent?.messages || chunk.messages;

	// Handle messages array format
	if (Array.isArray(messages) && messages.length > 0) {
		// Only process the last message (most recent) to avoid re-displaying history
		// Work backwards to find the last AI message
		for (let i = messages.length - 1; i >= 0; i--) {
			const msg = messages[i];

			// Get message type - handle both formats:
			// 1. LangChain format: id is array like ["langchain_core", "messages", "AIMessage"]
			// 2. Simple format: id is string, type is "ai" or "human"
			let messageType: string;
			if (Array.isArray(msg.id) && msg.id.length >= 3) {
				// LangChain format - type is in id[2]
				messageType = msg.id[2];
			} else {
				// Simple format - use type field directly
				messageType = msg.type;
			}

			// Only process AI message types - skip everything else
			// Handle both "AIMessage" and "ai" formats
			const isAIMessage =
				messageType === "AIMessage" || messageType === "ai";
			if (!isAIMessage) {
				continue;
			}

			// Get content - check both kwargs (LangChain) and direct (simple) formats
			const content = msg.kwargs?.content || msg.content;

			// Extract text content from message
			if (content) {
				if (typeof content === "string" && content.length > 0) {
					return {
						text: content,
						type: "text",
					};
				} else if (Array.isArray(content)) {
					// Content can be array of content blocks
					const textBlocks = content
						.filter((block: any) => block.type === "text" && block.text)
						.map((block: any) => block.text);
					if (textBlocks.length > 0) {
						return {
							text: textBlocks.join(""),
							type: "text",
						};
					}
				}
			}

			// Extract tool calls (check both kwargs and top level)
			const toolCalls = msg.kwargs?.tool_calls || msg.tool_calls;
			if (toolCalls && Array.isArray(toolCalls) && toolCalls.length > 0) {
				for (const toolCall of toolCalls) {
					if (toolCall.name) {
						return {
							toolCall: {
								name: toolCall.name,
								args: toolCall.args,
							},
							type: "tool",
						};
					}
				}
			}

			// Found AI message but no content/tools - stop looking
			break;
		}
	}

	// Handle direct message format
	if (chunk.content) {
		if (typeof chunk.content === "string") {
			return {
				text: chunk.content,
				type: "text",
			};
		}
	}

	// Handle tool calls at top level
	if (chunk.tool_calls && Array.isArray(chunk.tool_calls)) {
		for (const toolCall of chunk.tool_calls) {
			if (toolCall.name) {
				return {
					toolCall: {
						name: toolCall.name,
						args: toolCall.args,
					},
					type: "tool",
				};
			}
		}
	}

	// Handle state updates (informational)
	if (chunk.next || chunk.metadata) {
		return {
			type: "state",
		};
	}

	return {
		type: "unknown",
	};
}

/**
 * Format parsed chunk for CLI display
 */
export function formatParsedChunk(parsed: ParsedChunk): string | null {
	switch (parsed.type) {
		case "text":
			return parsed.text || null;

		case "tool":
			if (parsed.toolCall) {
				const argsStr = parsed.toolCall.args
					? ` ${JSON.stringify(parsed.toolCall.args)}`
					: "";
				return `\n🔧 Using tool: ${parsed.toolCall.name}${argsStr}\n`;
			}
			return null;

		case "state":
			// Silent state updates
			return null;

		case "unknown":
			// Don't display unknown chunks
			return null;

		default:
			return null;
	}
}

/**
 * Process a stream chunk and return displayable text
 * Returns null if nothing should be displayed
 */
export function processStreamChunk(chunk: any): string | null {
	const parsed = parseStreamChunk(chunk);
	if (!parsed) {
		return null;
	}
	return formatParsedChunk(parsed);
}
