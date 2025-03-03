import type { BaseChatModel } from "@langchain/core/language_models/chat_models";
import type { GraphStateAnnotation } from "../../composer/v2/agents";
import type { baseToolSchema } from "../../composer/v2/tools/schemas";
import {
	AIMessageChunk,
	HumanMessage,
	type MessageContent,
	type MessageContentComplex,
	ToolMessage,
} from "@langchain/core/messages";
import { Tiktoken } from "js-tiktoken/lite";
//@ts-expect-error
import o200k_base from "js-tiktoken/ranks/o200k_base";
import type { z } from "zod";

const tokenThreshold = 8096;
export async function trimMessages(
	state: GraphStateAnnotation,
	model: BaseChatModel,
) {
	const currentTokenCount = getTokenCount(state);

	if (currentTokenCount <= tokenThreshold) return state.messages;

	let chat = "";
	for (const message of state.messages) {
		if (message instanceof HumanMessage) {
			for (const content of message.content as MessageContentComplex[]) {
				if (content.type === "text") {
					chat += `human: ${content.text}`;
				}
			}
		} else if (message instanceof ToolMessage) {
			const msgContent = String(message.content);
			if (msgContent.startsWith("{")) {
				const toolInput = JSON.parse(msgContent) as z.infer<
					typeof baseToolSchema
				>;
				chat += `tool_result: ${message.name} - ${toolInput.explanation ?? "ommited"}`;
			}
		} else if (message instanceof AIMessageChunk) {
			for (const content of message.content as MessageContentComplex[]) {
				if (content.type === "tool_use") continue;

				//@ts-expect-error
				chat += `assistant: ${content.text}`;
			}

			for (const toolUse of message.tool_calls ?? []) {
				chat += `tool_use: ${toolUse.name}`;
			}
		}
	}

	return [
		await summarizeConversation(chat, model, state.summary),
		state.messages[state.messages.length - 1],
	];
}

export function getTokenCount(state: GraphStateAnnotation) {
	const enc = new Tiktoken(o200k_base);
	const getTokens = (input: string) => {
		try {
			return enc.encode(input);
		} catch {}

		return 0;
	};

	const handleMessageContentTokens = (messageContent: MessageContent) => {
		let tokens: number[] = [];

		if (Array.isArray(messageContent)) {
			for (const content of messageContent) {
				if (content.type === "tool_use") continue;
				//@ts-expect-error
				tokens = tokens.concat(getTokens(content.text));
			}
		} else {
			//@ts-expect-error
			tokens = tokens.concat(getTokens(messageContent.text));
		}

		return tokens;
	};

	let tokens: number[] = [];
	for (const message of state.messages) {
		if (message instanceof HumanMessage) {
			tokens = tokens.concat(handleMessageContentTokens(message.content));
		} else if (message instanceof ToolMessage) {
			tokens = tokens.concat(handleMessageContentTokens(message.content));
		} else if (message instanceof AIMessageChunk) {
			// type text
			// tool_calls
			tokens = tokens.concat(handleMessageContentTokens(message.content));
		}
	}

	return tokens.length;
}

async function summarizeConversation(
	summary: string,
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
					text: `Conversation Messages:${summary}`,
				},
			],
		}),
		new HumanMessage({ content: summaryMessage }),
	];

	return model.invoke(messages);
}
