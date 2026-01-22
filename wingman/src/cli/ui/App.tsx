import React, { useState, useEffect } from "react";
import { Box, Text } from "ink";
import { LogDisplay, type LogEntry } from "./LogDisplay.js";
import { AgentOutput } from "./AgentOutput.js";
import { ErrorDisplay } from "./ErrorDisplay.js";
import type { OutputManager } from "../core/outputManager.js";
import type { OutputEvent } from "../types.js";

export interface AppProps {
	outputManager: OutputManager;
}

export const App: React.FC<AppProps> = ({ outputManager }) => {
	const [logs, setLogs] = useState<LogEntry[]>([]);
	const [agentName, setAgentName] = useState<string>("");
	const [agentContent, setAgentContent] = useState<string>("");
	const [isStreaming, setIsStreaming] = useState(false);
	const [error, setError] = useState<{ message: string; stack?: string }>();
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
					// Parse chunk - for now, just stringify it
					// TODO: Parse chunk to extract text deltas, tool calls, etc.
					const chunkStr = JSON.stringify(event.chunk, null, 2);
					setAgentContent((prev) => prev + "\n" + chunkStr);
					break;

				case "agent-complete":
					setIsStreaming(false);
					setIsComplete(true);
					// Display the final result
					if (typeof event.result === "string") {
						setAgentContent(event.result);
					} else {
						setAgentContent(JSON.stringify(event.result, null, 2));
					}
					break;

				case "agent-error":
					setIsStreaming(false);
					setError({
						message: event.error,
						stack: event.stack,
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

			{agentContent && (
				<Box marginTop={1}>
					<AgentOutput content={agentContent} isStreaming={isStreaming} />
				</Box>
			)}

			{error && (
				<Box marginTop={1}>
					<ErrorDisplay error={error.message} stack={error.stack} />
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
