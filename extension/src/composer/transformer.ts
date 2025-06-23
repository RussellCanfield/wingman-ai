import {
	type ComposerMessage,
	UserMessage,
	type ComposerState,
	AssistantMessage,
	ToolMessage,
} from "@shared/types/Composer";
import type { GraphStateAnnotation } from ".";
import {
	HumanMessage,
	ToolMessage as LangChainToolMessage,
	type MessageContentComplex,
	type BaseMessage,
	type MessageContentText,
	AIMessageChunk,
	type MessageContentImageUrl,
} from "@langchain/core/messages";

/**
 * Transforms a GraphStateAnnotation into a ComposerState
 */
export const transformState = async (
	state: GraphStateAnnotation,
	threadId: string,
	workspace: string,
	canResume?: boolean,
): Promise<ComposerState> => {
	const messages = !state.messages ? [] : mapMessages(state.messages);

	return {
		messages,
		threadId,
		canResume,
		title: state.title,
		createdAt: state.createdAt,
		parentThreadId: state.parentThreadId,
	} satisfies ComposerState;
};

/**
 * Maps LangChain message types to Composer message types
 */
const mapMessages = (messages: BaseMessage[]): ComposerMessage[] => {
	return messages.flatMap((message): ComposerMessage[] => {
		// Handle HumanMessage
		if (message instanceof HumanMessage && !message.additional_kwargs.temp) {
			if (Array.isArray(message.content)) {
				const imageMsg = (message.content as MessageContentComplex[]).find(
					(c) => c.type === "image_url",
				) as MessageContentImageUrl | undefined;
				const messageContent = message.content as MessageContentText[];
				const lastContent = messageContent[messageContent.length - 1];
				return [
					new UserMessage(
						message.id!,
						lastContent.text,
						imageMsg
							? {
									//@ts-expect-error
									data: imageMsg.image_url.url,
									ext: "image/jpeg",
								}
							: undefined,
					),
				];
			}

			return [
				new UserMessage(message.id!, message.content as string, undefined),
			];
		}

		// Handle AIMessageChunk
		if (message instanceof AIMessageChunk) {
			const results: ComposerMessage[] = [];

			// Handle simple content (string)
			if (!Array.isArray(message.content) && message.content) {
				results.push(
					new AssistantMessage(
						message.id!,
						message.content,
						message.usage_metadata?.input_tokens,
						message.usage_metadata?.output_tokens,
					),
				);
			} else {
				const messageContent = message.content as MessageContentComplex[];

				// Add text content
				for (const content of messageContent) {
					if (content.type === "text" && content.text) {
						results.push(
							new AssistantMessage(
								message.id!,
								content.text,
								message.usage_metadata?.input_tokens,
								message.usage_metadata?.output_tokens,
							),
						);
					}
				}
			}

			// Add tool calls if present
			if (message.tool_calls?.length) {
				for (const toolCall of message.tool_calls) {
					results.push(
						new ToolMessage(
							message.id!,
							toolCall.name,
							toolCall.id! ?? message.id!,
							toolCall.args,
							"start",
							message.additional_kwargs,
						),
					);
				}
			}

			return results;
		}

		// Handle LangChainToolMessage
		if (message instanceof LangChainToolMessage) {
			let content = message.content;
			if (typeof content === "string") {
				try {
					content = JSON.parse(content);
				} catch {}
			}
			return [
				new ToolMessage(
					message.id!,
					message.name!,
					message.tool_call_id! ?? message.id!,
					content as unknown as Record<string, unknown>,
					"end",
					message.additional_kwargs,
				),
			];
		}

		// Return empty array for unhandled message types
		return [];
	});
};
