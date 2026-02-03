import React from "react";
import { Text, Box } from "ink";

export interface ErrorDisplayProps {
	error: string;
	stack?: string;
	showStack?: boolean;
	logFile?: string;
}

export const ErrorDisplay: React.FC<ErrorDisplayProps> = ({
	error,
	stack,
	showStack = false,
	logFile,
}) => {
	return (
		<Box flexDirection="column" paddingY={1}>
			<Text color="red" bold>
				Error:
			</Text>
			<Text color="red">{error}</Text>
			{logFile && <Text color="gray">Logs: {logFile}</Text>}
			{showStack && stack && (
				<Box flexDirection="column" marginTop={1}>
					<Text color="gray">Stack trace:</Text>
					<Text color="gray">{stack}</Text>
				</Box>
			)}
		</Box>
	);
};
