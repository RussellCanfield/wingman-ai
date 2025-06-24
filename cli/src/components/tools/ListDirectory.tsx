import type { Message } from "../../contexts/WingmanContext";
import { Box, Text } from "ink";

export function ListDirectoryTool({ message }: { message: Message }) {
	const directoryPath = message.args as { directory: string; depth?: number };

	return (
		<Box flexDirection="column">
			<Box>
				<Text color="cyan">Listing directory - {directoryPath.directory}, depth: {directoryPath.depth}</Text>
			</Box>
		</Box>
	);
}
