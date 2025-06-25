import type { Message } from "src/contexts/types";
import { Box, Text } from "ink";

export function ListDirectoryTool({ message }: { message: Message }) {
	const { directory, depth } = message.args as {
		directory: string;
		depth?: number;
	};

	const content = `Directory: ${directory}`;

	return (
		<Box flexDirection="column" gap={1}>
			<Text color="cyan">📂 Crawled directory - {directory}</Text>
		</Box>
	);
}
