import type React from "react";
import { Box, Text } from "ink";
import { useWingman } from "../contexts/WingmanContext";
import os from "node:os";
import { getModelCosts, getContextWindow } from "@wingman-ai/agent";
import { ProgressBar, Spinner } from "@inkjs/ui";
import { Status } from "src/contexts/types";

const StatusBar: React.FC = () => {
	const {
		status,
		inputTokens,
		outputTokens,
		model,
		contextFiles,
		contextDirectories,
		isContextViewExpanded,
	} = useWingman();

	const hasContext = contextFiles.length > 0 || contextDirectories.length > 0;
	const isMac = os.platform() === "darwin";
	const toggleKey = isMac ? "Cmd+B" : "Ctrl+B";
	const clearKey = isMac ? "Cmd+D" : "Ctrl+D";

	const modelInfo = getModelCosts(model);
	const contextWindow = getContextWindow(model) ?? 200_000;

	const totalTokens = inputTokens + outputTokens;
	const cost = modelInfo
		? (inputTokens / contextWindow) * modelInfo.input +
		(outputTokens / contextWindow) * modelInfo.output
		: 0;

	const contextPercentage =
		contextWindow && totalTokens > 0
			? Math.min((totalTokens / contextWindow) * 100, 100)
			: 0;

	const roundedContextPercentage = Math.round(contextPercentage);

	return (
		<Box
			borderStyle="round"
			borderColor="grey"
			borderTop={true}
			paddingX={1}
			marginTop={1}
			flexDirection="column"
		>
			{isContextViewExpanded && hasContext && (
				<Box flexDirection="column" marginBottom={1}>
					<Text bold>Context:</Text>
					{contextFiles.length > 0 && (
						<Box flexDirection="column" marginLeft={2}>
							<Text bold>Files:</Text>
							{contextFiles.map((file) => (
								<Text key={file}>- {file}</Text>
							))}
						</Box>
					)}
					{contextDirectories.length > 0 && (
						<Box flexDirection="column" marginLeft={2} marginTop={1}>
							<Text bold>Directories:</Text>
							{contextDirectories.map((dir) => (
								<Text key={dir}>- {dir}</Text>
							))}
						</Box>
					)}
				</Box>
			)}
			{status !== Status.Compacting && (<Box justifyContent="space-between">
				<Box>
					<Text>
						<Text color="green">▲</Text> {inputTokens}
					</Text>
					<Text> | </Text>
					<Text>
						<Text color="red">▼</Text> {outputTokens}
					</Text>
					<Text> | </Text>
					<Text>Est. Cost: ${cost.toFixed(4)}</Text>
					{hasContext && (
						<Box marginLeft={2}>
							<Text>
								Context: {contextFiles.length} files, {contextDirectories.length}{" "}
								directories
							</Text>
						</Box>
					)}
				</Box>
				{contextWindow && (
					<Box width={30}>
						<ProgressBar value={roundedContextPercentage} />
					</Box>
				)}
			</Box>)}
			{status === Status.Compacting && (
				<Box justifyContent="flex-end">
					<Spinner />
					<Text color="yellow"> Compacting conversation...</Text>
				</Box>
			)}
			{hasContext && (
				<Box justifyContent="flex-end">
					<Text color="gray">
						(Press '{toggleKey}' to toggle, '{clearKey}' to clear)
					</Text>
				</Box>
			)}
		</Box>
	);
};

export default StatusBar;
