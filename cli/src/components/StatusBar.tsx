import type React from "react";
import { Box, Text } from "ink";
import { useWingman } from "../contexts/WingmanContext";
import os from "node:os";
import { getModelCosts, getContextWindow } from "@wingman-ai/agent";

const StatusBar: React.FC = () => {
	const {
		inputTokens,
		outputTokens,
		model,
		contextFiles,
		contextDirectories,
		isContextViewExpanded,
	} = useWingman();

	const hasContext = contextFiles.length > 0 || contextDirectories.length > 0;
	const isMac = os.platform() === "darwin";
	const toggleKey = isMac ? "Cmd+V" : "Ctrl+V";
	const clearKey = isMac ? "Cmd+K" : "Ctrl+K";

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

	const progressBarLength = 20;
	const filledLength = Math.round((contextPercentage / 100) * progressBarLength);
	const emptyLength = progressBarLength - filledLength;

	const filledBar = "■".repeat(filledLength);
	const emptyBar = "□".repeat(emptyLength);

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
			<Box justifyContent="space-between">
				<Box>
					<Text>
						<Text color="green">▲</Text> {inputTokens}
					</Text>
					<Text> | </Text>
					<Text>
						<Text color="red">▼</Text> {outputTokens}
					</Text>
					<Text> | </Text>
					<Text>Cost: ${cost.toFixed(4)}</Text>
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
					<Box>
						<Text>
							{` ${filledBar}`}
							<Text color="gray">{emptyBar}</Text>
							{` ${contextPercentage.toFixed(2)}%`}
						</Text>
					</Box>
				)}
			</Box>
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
