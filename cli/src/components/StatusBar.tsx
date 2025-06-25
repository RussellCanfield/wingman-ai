 import type React from "react";
import { Box, Text } from "ink";
import { useWingman } from "../contexts/WingmanContext";
import os from "node:os";

const StatusBar: React.FC = () => {
	const {
		totalTokens,
		contextFiles,
		contextDirectories,
		isContextViewExpanded,
	} = useWingman();

	const hasContext = contextFiles.length > 0 || contextDirectories.length > 0;
	const isMac = os.platform() === "darwin";
	const toggleKey = isMac ? "Cmd+V" : "Ctrl+V";
	const clearKey = isMac ? "Cmd+K" : "Ctrl+K";

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
					<Text>Total Tokens: {totalTokens}</Text>
					{hasContext && (
						<Box marginLeft={2}>
							<Text>
								Context: {contextFiles.length} files, {contextDirectories.length}{" "}
								directories
							</Text>
						</Box>
					)}
				</Box>
				{hasContext && (
					<Box>
						<Text color="gray">
							(Press '{toggleKey}' to toggle, '{clearKey}' to clear)
						</Text>
					</Box>
				)}
			</Box>
		</Box>
	);
};

export default StatusBar;
