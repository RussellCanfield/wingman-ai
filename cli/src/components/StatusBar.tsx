import type React from "react";
import { Box, Text } from "ink";
import { useWingman } from "../contexts/WingmanContext";
import os from "node:os";
import { getModelCosts, getContextWindow } from "@wingman-ai/agent";
import { Status } from "src/contexts/types";
import { useMemo } from "react";
import { Spinner } from "./Spinner";
import ProgressBar from "./ProgressBar";

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

	// Memoize expensive calculations
	const { cost, contextPercentage, roundedContextPercentage } = useMemo(() => {
		const modelInfo = getModelCosts(model);
		const contextWindow = getContextWindow(model) ?? 200_000;
		const totalTokens = inputTokens + outputTokens;

		const calculatedCost = modelInfo
			? (inputTokens / contextWindow) * modelInfo.input +
			(outputTokens / contextWindow) * modelInfo.output
			: 0;

		const calculatedContextPercentage =
			contextWindow && totalTokens > 0
				? Math.min((totalTokens / contextWindow) * 100, 100)
				: 0;

		return {
			cost: calculatedCost,
			contextPercentage: calculatedContextPercentage,
			roundedContextPercentage: Math.round(calculatedContextPercentage),
		};
	}, [model, inputTokens, outputTokens]);

	// Memoize context display - now shows when expanded, regardless of context
	const contextDisplay = useMemo(() => {
		if (!isContextViewExpanded) return null;

		if (!hasContext) {
			return (
				<Box flexDirection="column" marginBottom={1}>
					<Text bold>Context:</Text>
					<Box marginLeft={2}>
						<Text color="gray">No context files or directories added yet.</Text>
						<Text color="gray">Use /file &lt;path&gt; or /dir &lt;path&gt; to add context.</Text>
					</Box>
				</Box>
			);
		}

		return (
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
		);
	}, [isContextViewExpanded, hasContext, contextFiles, contextDirectories]);

	// Memoize token and cost display
	const tokenDisplay = useMemo(() => {
		if (status === Status.Compacting || status === Status.ExecutingTool)
			return null;

		return (
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
					<Text>Est. Cost: ${cost.toFixed(4)}</Text>
					{hasContext && (
						<Box marginLeft={2}>
							<Text>
								Context: {contextFiles.length} files,{" "}
								{contextDirectories.length} directories
							</Text>
						</Box>
					)}
				</Box>
				{getContextWindow(model) && (
					<Box width={30}>
						<ProgressBar value={roundedContextPercentage} />
					</Box>
				)}
			</Box>
		);
	}, [
		status,
		inputTokens,
		outputTokens,
		cost,
		hasContext,
		contextFiles.length,
		contextDirectories.length,
		model,
		roundedContextPercentage,
	]);

	// Memoize activity display
	const activityDisplay = useMemo(() => {
		if (status === Status.Compacting) {
			return (
				<Box justifyContent="flex-end">
					<Spinner />
					<Text color="yellow"> Compacting conversation...</Text>
				</Box>
			);
		}
		if (status === Status.ExecutingTool) {
			return (
				<Box justifyContent="flex-end">
					<Spinner />
					<Text color="yellow"> Executing tool...</Text>
				</Box>
			);
		}
		return null;
	}, [status]);

	// Memoize hotkey display - now shows based on context view state
	const hotkeyDisplay = useMemo(() => {
		return (
			<Box justifyContent="flex-end">
				<Text color="gray">
					(Press '{toggleKey}' to {isContextViewExpanded ? "hide" : "show"}{" "}
					context
					{hasContext ? `, '${clearKey}' to clear` : ""})
				</Text>
			</Box>
		);
	}, [isContextViewExpanded, hasContext, toggleKey, clearKey]);

	return (
		<Box
			borderStyle="round"
			borderColor="grey"
			borderTop={true}
			paddingX={1}
			marginTop={1}
			flexDirection="column"
		>
			{contextDisplay}
			{tokenDisplay}
			{activityDisplay}
			{hotkeyDisplay}
		</Box>
	);
};

export default StatusBar;
