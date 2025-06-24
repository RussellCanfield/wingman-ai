import type { Message } from "../../contexts/WingmanContext";
import { Box, Text } from "ink";

export function ListDirectoryTool({ message }: { message: Message }) {
	const directoryPath = message.args?.directory as string;

	return (
		<Box flexDirection="column">
			<Box>
				<Text color="cyan">Listing directory - {directoryPath}</Text>
			</Box>
		</Box>
	);
}
