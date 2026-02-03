import { v4 as uuidv4 } from "uuid";
import type {
	ContentBlock,
	TextBlock,
	ToolCallBlock,
	ToolResultBlock,
} from "../types.js";

/**
 * Create a text content block
 */
export function createTextBlock(
	content: string,
	isStreaming: boolean = false,
	id?: string,
): ContentBlock {
	return {
		id: id || uuidv4(),
		type: "text",
		timestamp: Date.now(),
		data: {
			content,
			isStreaming,
		} as TextBlock,
	};
}

/**
 * Create a tool call content block
 */
export function createToolCallBlock(toolCall: {
	id: string;
	name: string;
	args?: any;
}): ContentBlock {
	return {
		id: toolCall.id,
		type: "tool-call",
		timestamp: Date.now(),
		data: {
			name: toolCall.name,
			args: toolCall.args || {},
			status: "running",
			startTime: Date.now(),
		} as ToolCallBlock,
	};
}

/**
 * Create a tool result content block
 */
export function createToolResultBlock(toolResult: {
	id: string;
	output: any;
	error?: string;
}): ContentBlock {
	const outputStr =
		typeof toolResult.output === "string"
			? toolResult.output
			: JSON.stringify(toolResult.output, null, 2);

	return {
		id: uuidv4(),
		type: "tool-result",
		timestamp: Date.now(),
		data: {
			toolCallId: toolResult.id,
			output: outputStr,
			truncated: outputStr.length > 5000, // Truncate if > 5000 chars
			error: toolResult.error,
		} as ToolResultBlock,
	};
}
