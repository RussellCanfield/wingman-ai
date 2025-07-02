import { spinner, note, log } from "@clack/prompts";
import chalk from "chalk";
import { v4 as uuidv4 } from "uuid";
import type {
	WingmanAgent,
	WingmanGraphState,
	WingmanRequest,
} from "@wingman-ai/agent";
import {
	AIMessage,
	AIMessageChunk,
	type ToolMessage,
	type BaseMessage,
} from "@langchain/core/messages";
import { agentLogger, logPerformance } from "../../utils/logger.js";
import type { StreamingState } from "../types/CLITypes.js";
import type { ToolCall } from "@langchain/core/messages/tool";
import { getToolDisplay } from "./tools/index.js";

export class MessageStreamer {
	constructor(
		private agent: WingmanAgent,
		private state: StreamingState,
	) {}

	async streamResponse(request: WingmanRequest): Promise<void> {
		const s = spinner();
		s.start("Thinking...");

		const streamStartTime = Date.now();
		let messageCount = 0;
		let toolCallCount = 0;
		let aiResponse = "";
		let toolCalls: ToolCall[] = [];

		try {
			for await (const res of this.agent.stream(request)) {
				const { messages: newMessages } = res as WingmanGraphState;
				const message = newMessages[newMessages.length - 1] as BaseMessage;
				messageCount++;

				agentLogger.trace(
					{
						event: "stream_message_received",
						messageType: message.getType(),
						messageIndex: messageCount,
						hasContent: !!message.content,
						hasToolCalls: !!(message as any).tool_calls?.length,
						hasUsageMetadata: !!(message as any).usage_metadata,
					},
					`Received stream message ${messageCount}: ${message.getType()}`,
				);

				if (message instanceof AIMessageChunk || message instanceof AIMessage) {
					// Handle AI message content
					if (message.content) {
						const newContent =
							typeof message.content === "string"
								? message.content
								: message.content.toString();

						if (newContent !== aiResponse) {
							aiResponse = newContent;

							// Update spinner with progress
							const preview = this.truncateForSpinner(aiResponse);
							s.message(`Responding... ${preview}`);
						}
					}

					// Handle token usage
					if (message.usage_metadata) {
						agentLogger.debug(
							{
								event: "tokens_received",
								inputTokens: message.usage_metadata.input_tokens,
								outputTokens: message.usage_metadata.output_tokens,
								totalTokens: message.usage_metadata.total_tokens,
							},
							"Token usage updated",
						);

						this.state.inputTokens += message.usage_metadata.input_tokens || 0;
						this.state.outputTokens +=
							message.usage_metadata.output_tokens || 0;
					}

					// Handle tool calls
					if (message.tool_calls && message.tool_calls.length > 0) {
						toolCalls = message.tool_calls;
						agentLogger.debug(
							{
								event: "tool_calls_detected",
								toolCalls: message.tool_calls.length,
								messageId: message.id,
							},
							`Detected ${message.tool_calls.length} tool calls in message ${message.id}`,
						);

						s.message("Using tools...");
					}
				}

				if (message.getType() === "tool") {
					toolCallCount++;
					const toolMessage = message as ToolMessage;
					const toolCall = toolCalls.find(
						(tc) => tc.id === toolMessage.tool_call_id,
					);

					agentLogger.info(
						{
							event: "tool_message_received",
							toolCallId: toolMessage.tool_call_id,
							toolCallIndex: toolCallCount,
							contentLength: (message.content as string)?.length || 0,
						},
						`Tool message ${toolCallCount} received`,
					);

					s.message(
						`Executing tool - ${toolCall ? getToolDisplay(toolCall) : "Unknown tool"}...`,
					);
				}
			}

			s.stop(chalk.green("Response complete"));

			// Display final AI response
			if (aiResponse) {
				log.message(chalk.green("🤖 Wingman: ") + aiResponse);

				// Add to message history
				const currentAIMessage = {
					id: uuidv4(),
					type: "ai" as const,
					content: aiResponse,
					toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
					timestamp: new Date(),
				};
				this.state.messages.push(currentAIMessage);
			}

			// Show token usage if we have it
			if (this.state.inputTokens > 0 || this.state.outputTokens > 0) {
				const tokenInfo = `Input: ${chalk.cyan(this.state.inputTokens.toLocaleString())} | Output: ${chalk.cyan(this.state.outputTokens.toLocaleString())} | Total: ${chalk.cyan((this.state.inputTokens + this.state.outputTokens).toLocaleString())}`;
				note(tokenInfo, "Token Usage:");
			}

			const streamDuration = Date.now() - streamStartTime;
			logPerformance("WingmanCLI", "agent_stream", streamDuration, {
				messageCount,
				toolCallCount,
				inputLength: request.input.length,
			});
		} catch (error) {
			s.stop(chalk.red("Error occurred"));
			throw error;
		}

		// Add some spacing for readability
		console.log();
	}

	private truncateForSpinner(text: string, maxLength = 50): string {
		if (text.length <= maxLength) return text;
		return `${text.substring(0, maxLength)}...`;
	}
}
