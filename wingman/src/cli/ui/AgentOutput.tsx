import React from "react";
import { Text, Box } from "ink";

export interface AgentOutputProps {
	content: string;
	isStreaming?: boolean;
}

export const AgentOutput: React.FC<AgentOutputProps> = ({
	content,
	isStreaming = false,
}) => {
	return (
		<Box flexDirection="column" paddingY={1}>
			<Text bold color="green">
				Agent Response:
			</Text>
			<Text>{content}</Text>
			{isStreaming && (
				<Text color="gray" dimColor>
					...
				</Text>
			)}
		</Box>
	);
};
