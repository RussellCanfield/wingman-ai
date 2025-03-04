import type { BaseChatModel } from "@langchain/core/language_models/chat_models";
import type { GraphStateAnnotation } from "../../composer/v2/agents";
import type { baseToolSchema } from "../../composer/v2/tools/schemas";
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

// The threshold to trigger summarization
const tokenThreshold = 32000;

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

	if (currentTokenCount <= tokenThreshold) return state.messages;

	let chat = "";
	for (const message of state.messages) {
		if (message instanceof HumanMessage) {
			const content = message.content;
			if (Array.isArray(content)) {
				for (const item of content) {
					if (item.type === "text") {
						chat += `human: ${item.text}\n\n`;
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
		} else if (message instanceof AIMessageChunk) {
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
	const summary = await summarizeConversation(chat, model, state.summary);

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
				if (content.type === "tool_use") continue;
				if (content.type === "text" && "text" in content) {
					totalTokens += getTokens(content.text).length;
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

	for (const message of state.messages) {
		if (
			message instanceof HumanMessage ||
			message instanceof ToolMessage ||
			message instanceof AIMessageChunk ||
			message instanceof AIMessage
		) {
			totalTokenCount += handleMessageContentTokens(message.content);

			// Handle tool calls separately for AIMessageChunk
			if (message instanceof AIMessageChunk && message.tool_calls) {
				for (const toolCall of message.tool_calls) {
					if (toolCall.name) {
						totalTokenCount += getTokens(toolCall.name).length;
					}
					if (toolCall.args) {
						try {
							totalTokenCount += getTokens(
								JSON.stringify(toolCall.args),
							).length;
						} catch {}
					}
				}
			}
		}
	}

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
