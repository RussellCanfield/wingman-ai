import React from "react";
import { Box, Text } from "ink";
import type { ToolResultBlock } from "../../types.js";

interface ToolResultDisplayProps {
	result: ToolResultBlock;
	executionTime?: number; // In seconds
}

const MAX_PREVIEW_LENGTH = 200;

export const ToolResultDisplay: React.FC<ToolResultDisplayProps> = ({
	result,
	executionTime,
}) => {
	const hasError = !!result.error;
	const outputLength = result.output.length;
	const isLong = outputLength > MAX_PREVIEW_LENGTH;
	const preview = isLong
		? result.output.substring(0, MAX_PREVIEW_LENGTH) + "..."
		: result.output;

	return (
		<Box flexDirection="column" marginY={1}>
			<Box
				borderStyle="single"
				borderColor={hasError ? "red" : "gray"}
				paddingX={1}
			>
				<Box flexDirection="column" width="100%">
					{/* Header */}
					<Box>
						<Text bold color={hasError ? "red" : "green"}>
							{hasError ? "✗ Error" : "✓ Result"}
						</Text>
						{executionTime !== undefined && (
							<Text dimColor> ({executionTime.toFixed(2)}s)</Text>
						)}
					</Box>

					{/* Error message */}
					{hasError && (
						<Box marginTop={1}>
							<Text color="red">{result.error}</Text>
						</Box>
					)}

					{/* Output preview */}
					{!hasError && result.output && (
						<Box flexDirection="column" marginTop={1}>
							{isLong && (
								<Text dimColor>
									({outputLength.toLocaleString()} characters)
								</Text>
							)}
							<Box marginTop={isLong ? 1 : 0}>
								<Text>{preview}</Text>
							</Box>
							{result.truncated && (
								<Box marginTop={1}>
									<Text dimColor italic>
										[Output truncated - full result available in session]
									</Text>
								</Box>
							)}
						</Box>
					)}
				</Box>
			</Box>
		</Box>
	);
};
