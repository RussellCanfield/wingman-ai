import React, { useState, useEffect, useRef } from "react";
import { Box, Text } from "ink";
import { LogDisplay, type LogEntry } from "./LogDisplay.js";
import { AgentOutput } from "./AgentOutput.js";
import { ErrorDisplay } from "./ErrorDisplay.js";
import type { OutputManager } from "../core/outputManager.js";
import type {
	OutputEvent,
	ContentBlock,
	TextBlock,
	ToolCallBlock,
} from "../types.js";
import { parseStreamChunk } from "../core/streamParser.js";
import {
	createTextBlock,
	createToolCallBlock,
} from "./blockHelpers.js";

export interface AppProps {
	outputManager: OutputManager;
}

export const App: React.FC<AppProps> = ({ outputManager }) => {
	const [logs, setLogs] = useState<LogEntry[]>([]);
	const [agentName, setAgentName] = useState<string>("");
	const [contentBlocks, setContentBlocks] = useState<ContentBlock[]>([]);
	const [activeTools, setActiveTools] = useState<Map<string, ToolCallBlock>>(
		new Map(),
	);
	const processedToolCallIdsRef = useRef<Set<string>>(new Set());
	const processedToolResultIdsRef = useRef<Set<string>>(new Set());
	const [isStreaming, setIsStreaming] = useState(false);
	const [error, setError] = useState<{
		message: string;
		stack?: string;
		logFile?: string;
	}>();
	const [isComplete, setIsComplete] = useState(false);

	useEffect(() => {
		const handleEvent = (event: OutputEvent) => {
			switch (event.type) {
				case "log":
					setLogs((prev) => [
						...prev,
						{
							level: event.level,
							message: event.message,
							timestamp: event.timestamp,
							args: event.args,
						},
					]);
					break;

				case "agent-start":
					setAgentName(event.agent);
					setIsStreaming(true);
					break;

				case "agent-stream":
					// Parse chunk to extract text, tool calls, and tool results
					const parsedArray = parseStreamChunk(event.chunk);
					if (!parsedArray || parsedArray.length === 0) break;

					// Process each parsed chunk
					for (const parsed of parsedArray) {
						switch (parsed.type) {
							case "text":
								if (parsed.text) {
									const text = parsed.text;
									const messageId = parsed.messageId;
									// Append to last text block or create new one
									setContentBlocks((prev) => {
										const updateBlockAtIndex = (
											index: number,
											text: string,
										): ContentBlock[] => {
											const existingBlock = prev[index];
											const existingContent = (existingBlock.data as TextBlock)
												.content;
											let nextContent = existingContent;
											if (text.startsWith(existingContent)) {
												nextContent = text;
											} else {
												nextContent = existingContent + text;
											}

											const updatedData = {
												...existingBlock.data,
												content: nextContent,
												isStreaming: true,
											};

											return [
												...prev.slice(0, index),
												{ ...existingBlock, data: updatedData },
												...prev.slice(index + 1),
											];
										};

										if (messageId) {
											const existingIndex = prev.findIndex(
												(block) => block.type === "text" && block.id === messageId,
											);
											if (existingIndex >= 0) {
												return updateBlockAtIndex(existingIndex, text);
											}
											return [
												...prev,
												createTextBlock(text, true, messageId),
											];
										} else {
											const lastBlock = prev[prev.length - 1];
											if (lastBlock?.type === "text") {
												return updateBlockAtIndex(
													prev.length - 1,
													text,
												);
											}
										}
										// Create new text block
										return [
											...prev,
											createTextBlock(text, true, messageId),
										];
									});
								}
								break;

							case "tool":
								if (parsed.toolCall) {
									const toolCall = parsed.toolCall;
									const alreadyProcessed =
										processedToolCallIdsRef.current.has(toolCall.id);

									// Track tool calls once, but keep args up to date for partial streams
									let toolBlock: ContentBlock | null = null;
									if (!alreadyProcessed) {
										processedToolCallIdsRef.current.add(toolCall.id);

										// Create new tool call block
										toolBlock = createToolCallBlock(toolCall);
										setContentBlocks((prev) => [...prev, toolBlock!]);
									}

									setActiveTools((prev) => {
										const updated = new Map(prev);
										const existing = updated.get(toolCall.id);
										if (existing) {
											const incomingArgs = toolCall.args || {};
											const mergedArgs =
												Object.keys(incomingArgs).length > 0
													? { ...existing.args, ...incomingArgs }
													: existing.args;
											updated.set(toolCall.id, {
												...existing,
												args: mergedArgs,
											});
											return updated;
										}

										if (toolBlock) {
											updated.set(
												toolBlock.id,
												toolBlock.data as ToolCallBlock,
											);
											return updated;
										}

										updated.set(toolCall.id, {
											name: toolCall.name,
											args: toolCall.args || {},
											status: "running",
											startTime: Date.now(),
										});
										return updated;
									});
								}
								break;

							case "tool-result":
								if (parsed.toolResult) {
									if (
										processedToolResultIdsRef.current.has(parsed.toolResult.id)
									) {
										break;
									}
									processedToolResultIdsRef.current.add(parsed.toolResult.id);

									const outputStr =
										typeof parsed.toolResult.output === "string"
											? parsed.toolResult.output
											: JSON.stringify(parsed.toolResult.output, null, 2);
									const truncated = outputStr.length > 5000;

									// Update tool status
									setActiveTools((prev) => {
										const updated = new Map(prev);
										const tool = updated.get(parsed.toolResult!.id);
										if (tool) {
											tool.status = parsed.toolResult!.error
												? "error"
												: "complete";
											tool.endTime = Date.now();
											tool.result = {
												output: outputStr,
												truncated,
												error: parsed.toolResult!.error,
											};
										}
										return updated;
									});

									setContentBlocks((prev) => {
										const toolIndex = prev.findIndex(
											(block) =>
												block.type === "tool-call" &&
												block.id === parsed.toolResult!.id,
										);
										if (toolIndex === -1) {
											return prev;
										}
										const toolBlock = prev[toolIndex];
										const status: ToolCallBlock["status"] = parsed.toolResult!
											.error
											? "error"
											: "complete";
										const updatedData: ToolCallBlock = {
											...(toolBlock.data as ToolCallBlock),
											status,
											endTime: Date.now(),
											result: {
												output: outputStr,
												truncated,
												error: parsed.toolResult!.error,
											},
										};
										return [
											...prev.slice(0, toolIndex),
											{ ...toolBlock, data: updatedData },
											...prev.slice(toolIndex + 1),
										];
									});
								}
								break;
						}
					}
					break;

				case "agent-complete":
					setIsStreaming(false);
					setIsComplete(true);
					// Mark last text block as not streaming
					setContentBlocks((prev) => {
						if (prev.length === 0) return prev;
						const lastBlock = prev[prev.length - 1];
						if (lastBlock.type === "text") {
							const updatedData = {
								...lastBlock.data,
								isStreaming: false,
							};
							return [...prev.slice(0, -1), { ...lastBlock, data: updatedData }];
						}
						return prev;
					});
					break;

				case "agent-error":
					setIsStreaming(false);
					setError({
						message: event.error,
						stack: event.stack,
						logFile: event.logFile,
					});
					break;
			}
		};

		outputManager.on("output-event", handleEvent);

		return () => {
			outputManager.off("output-event", handleEvent);
		};
	}, [outputManager]);

	return (
		<Box flexDirection="column" padding={1}>
			<Text bold color="cyan">
				Wingman CLI
			</Text>

			{agentName && (
				<Box marginTop={1}>
					<Text>
						Agent: <Text color="green">{agentName}</Text>
					</Text>
				</Box>
			)}

			{logs.length > 0 && (
				<Box flexDirection="column" marginTop={1}>
					<LogDisplay logs={logs} maxLogs={20} />
				</Box>
			)}

			{contentBlocks.length > 0 && (
				<Box marginTop={1}>
					<AgentOutput
						blocks={contentBlocks}
						activeTools={activeTools}
						isStreaming={isStreaming}
					/>
				</Box>
			)}

			{error && (
				<Box marginTop={1}>
					<ErrorDisplay
						error={error.message}
						stack={error.stack}
						logFile={error.logFile}
					/>
				</Box>
			)}

			{isComplete && !error && (
				<Box marginTop={1}>
					<Text color="green">✓ Complete</Text>
				</Box>
			)}
		</Box>
	);
};
