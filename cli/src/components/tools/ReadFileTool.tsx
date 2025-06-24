import type { Message } from "../../contexts/WingmanContext";
import { Box, Text } from "ink";

export function ReadFileTool({ message }: { message: Message }) {
	const filePath = message.args?.path as string;

	return (
		<Box flexDirection="column">
			<Box>
				<Text color="cyan">Reading file - {filePath}</Text>
			</Box>
		</Box>
	);
}
