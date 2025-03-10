import type { BaseChatModel } from "@langchain/core/language_models/chat_models";
import {
	AIMessage,
	AIMessageChunk,
	HumanMessage,
	type MessageContent,
	ToolMessage,
} from "@langchain/core/messages";
import { Tiktoken } from "js-tiktoken/lite";
//@ts-expect-error
import o200k_base from "js-tiktoken/ranks/o200k_base";
import type { z } from "zod";
import type { GraphStateAnnotation } from "../../composer";
import type { baseToolSchema } from "../../composer/tools/schemas";

// The threshold to trigger summarization
const tokenThreshold = 32000;
// Buffer to stay safely under the limit
const safetyBuffer = 1000;

/**
 * Trims messages when they exceed token threshold by summarizing the conversation
 * @param state Current graph state with messages
 * @param model LLM to use for summarization
 * @returns Trimmed message array
 */
export async function trimMessages(
	state: GraphStateAnnotation,
	model: BaseChatModel,
) {
	const currentTokenCount = getTokenCount(state);

	if (currentTokenCount <= tokenThreshold - safetyBuffer) return state.messages;

	let chat = "";
	for (const message of state.messages) {
		if (message instanceof HumanMessage) {
			const content = message.content;
			if (Array.isArray(content)) {
				for (const item of content) {
					if (item.type === "text") {
						chat += `human: ${item.text}\n\n`;
					} else if (item.type === "image_url") {
						chat += `human: ${item.image_url.url}\n\n`;
					}
				}
			} else if (typeof content === "string") {
				chat += `human: ${content}\n\n`;
			}
		} else if (message instanceof ToolMessage) {
			const msgContent = String(message.content);
			try {
				if (msgContent.startsWith("{")) {
					const toolInput = JSON.parse(msgContent) as z.infer<
						typeof baseToolSchema
					>;
					chat += `tool_result: ${message.name} - ${toolInput.explanation ?? "omitted"}\n\n`;
				} else {
					chat += `tool_result: ${message.name} - ${msgContent}\n\n`;
				}
			} catch (e) {
				// Handle JSON parsing errors
				chat += `tool_result: ${message.name} - ${msgContent}\n\n`;
			}
		} else if (
			message instanceof AIMessageChunk ||
			message instanceof AIMessage
		) {
			const content = message.content;
			if (Array.isArray(content)) {
				for (const item of content) {
					if (item.type === "text" && "text" in item) {
						chat += `assistant: ${item.text}\n\n`;
					} else if (item.type === "tool_use") {
						// Skip tool_use in content as we handle it separately below
					}
				}
			} else if (typeof content === "string") {
				chat += `assistant: ${content}\n\n`;
			}

			if (message.tool_calls && message.tool_calls.length > 0) {
				for (const toolUse of message.tool_calls) {
					chat += `tool_use: ${toolUse.name}\n\n`;
				}
			}
		}
	}

	// Create a summary and keep the last message
	const summary = await summarizeConversation(chat, model);

	return [summary, state.messages[state.messages.length - 1]];
}

/**
 * Calculates the total token count for all messages in the state
 * @param state Current graph state with messages
 * @returns Total token count
 */
export function getTokenCount(state: GraphStateAnnotation) {
	const enc = new Tiktoken(o200k_base);

	/**
	 * Encodes a string into tokens
	 * @param input String to encode
	 * @returns Array of token ids or empty array on error
	 */
	const getTokens = (input: string): number[] => {
		if (typeof input !== "string") return [];

		try {
			return enc.encode(input);
		} catch (error) {
			console.error("Token encoding error:", error);
			return [];
		}
	};

	/**
	 * Handles token counting for different message content types
	 * @param messageContent Content from a message
	 * @returns Total number of tokens
	 */
	const handleMessageContentTokens = (
		messageContent: MessageContent,
	): number => {
		let totalTokens = 0;

		if (Array.isArray(messageContent)) {
			for (const content of messageContent) {
				if (content.type === "tool_use") {
					// Count tool_use name and arguments
					if (content.tool_use?.name) {
						totalTokens += getTokens(content.tool_use.name).length;
					}
					if (content.tool_use?.args) {
						try {
							totalTokens += getTokens(
								JSON.stringify(content.tool_use.args),
							).length;
						} catch (e) {
							// Handle JSON stringification errors
							console.error("Error stringifying tool args:", e);
						}
					}
					continue;
				}
				if (content.type === "text" && "text" in content) {
					totalTokens += getTokens(content.text).length;
				} else if (content.type === "image_url" && "image_url" in content) {
					// Count a fixed number of tokens for image URLs (this is an approximation)
					totalTokens += content.image_url.url
						? content.image_url.url.length
						: 0; // Approximate token count for image embedding
				}
			}
		} else if (typeof messageContent === "string") {
			totalTokens += getTokens(messageContent).length;
		} else if (
			messageContent &&
			typeof messageContent === "object" &&
			"text" in messageContent
		) {
			//@ts-expect-error
			totalTokens += getTokens(messageContent.text).length;
		}

		return totalTokens;
	};

	let totalTokenCount = 0;

	// Add tokens for each message, including role tokens
	for (const message of state.messages) {
		// Add token count for role prefixes (estimate based on common models)
		if (message instanceof HumanMessage) {
			totalTokenCount += 4; // Approximate tokens for "user: "
		} else if (
			message instanceof AIMessage ||
			message instanceof AIMessageChunk
		) {
			totalTokenCount += 4; // Approximate tokens for "assistant: "
		} else if (message instanceof ToolMessage) {
			totalTokenCount += 4; // Approximate tokens for "tool: "
		} else {
			// For any other message type, add a default number
			totalTokenCount += 4;
		}

		// Handle message content
		if (
			message instanceof HumanMessage ||
			message instanceof ToolMessage ||
			message instanceof AIMessageChunk ||
			message instanceof AIMessage
		) {
			totalTokenCount += handleMessageContentTokens(message.content);

			// Handle tool calls for both AIMessage and AIMessageChunk
			if (
				(message instanceof AIMessageChunk || message instanceof AIMessage) &&
				message.tool_calls
			) {
				for (const toolCall of message.tool_calls) {
					if (toolCall.name) {
						totalTokenCount += getTokens(toolCall.name).length;
					}
					if (toolCall.args) {
						try {
							totalTokenCount += getTokens(
								JSON.stringify(toolCall.args),
							).length;
						} catch (e) {
							// Add a default count when JSON stringify fails
							console.error("Error stringifying tool args:", e);
							totalTokenCount += 10; // Add a minimum token count as fallback
						}
					}
				}
			}
		}
	}

	// Add a small overhead for formatting
	totalTokenCount += state.messages.length * 3;

	return totalTokenCount;
}

/**
 * Creates or extends a summary of the conversation
 * @param conversation Formatted conversation text
 * @param model LLM to use for summarization
 * @param originalSummary Optional existing summary to extend
 * @returns Message containing the summary
 */
async function summarizeConversation(
	conversation: string,
	model: BaseChatModel,
	originalSummary?: string,
) {
	// Create our summarization prompt
	let summaryMessage: string;
	if (originalSummary) {
		// A summary already exists
		summaryMessage = `This is a summary of the conversation to date: ${originalSummary}\n\nExtend the summary by taking into account the new messages above:`;
	} else {
		summaryMessage = "Create a summary of the conversation above:";
	}

	// Add prompt to our history
	const messages = [
		new AIMessageChunk({
			content: [
				{
					type: "text",
					text: `Conversation Messages:\n${conversation}`,
				},
			],
		}),
		new HumanMessage({ content: summaryMessage }),
	];

	return model.invoke(messages);
}
