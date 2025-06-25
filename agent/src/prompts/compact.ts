import type {
	AIMessage,
	BaseMessage,
	HumanMessage,
	ToolMessage,
} from "@langchain/core/messages";

/**
 * Creates a compact summary of a conversation history.
 *
 * This function processes an array of LangChain messages and generates a chronological
 * summary that preserves the key context of the interaction. It highlights user
 * requests, AI responses, and tool usage, making it easier for the AI to understand
 * the conversation flow and determine the next steps.
 *
 * @param messages An array of `BaseMessage` objects representing the conversation history.
 * @returns A string containing the structured summary of the conversation.
 */
export const compactConversationPrompt = (messages: BaseMessage[]): string => {
	const summaryLines: string[] = [
		"This is a summary of our conversation so far. Use it to understand the context and decide on the next action. Pay close attention to the most recent messages to determine the immediate task.",
		"---",
	];

	for (const message of messages) {
		let line = "";
		const messageType = message._getType();

		switch (messageType) {
			case "human": {
				const humanMessage = message as HumanMessage;
				line = `You asked: ${humanMessage.content}`;
				break;
			}
			case "ai": {
				const aiMessage = message as AIMessage;
				let content = "";

				if (aiMessage.content) {
					content += `I responded: "${aiMessage.content}"\n`;
				}

				if (aiMessage.tool_calls && aiMessage.tool_calls.length > 0) {
					const toolCallSummary = aiMessage.tool_calls
						.map((toolCall) => {
							const args = JSON.stringify(toolCall.args);
							return `I used the '${toolCall.name}' tool with these arguments: ${args}.`;
						})
						.join("\n");
					content += toolCallSummary;
				}
				line = content.trim();
				break;
			}
			case "tool": {
				const toolMessage = message as ToolMessage;
				const toolOutput =
					typeof toolMessage.content === "string"
						? toolMessage.content
						: JSON.stringify(toolMessage.content, null, 2);
				line = `The tool produced this result: ${toolOutput}`;
				break;
			}
			default: {
				const genericContent =
					typeof message.content === "string"
						? message.content
						: JSON.stringify(message.content);
				line = `[${messageType}] ${genericContent}`;
				break;
			}
		}

		// Truncate long lines to keep the summary concise
		if (line.length > 1000) {
			line = `${line.slice(0, 997)}...`;
		}

		if (line) {
			summaryLines.push(line);
		}
	}

	summaryLines.push(
		"---",
		"Given this conversation history, please proceed with the current task. Remember to focus on the latest messages to guide your next actions.",
	);

	return summaryLines.join("\n\n");
};
