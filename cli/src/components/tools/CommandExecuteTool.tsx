import type { Message } from "../../contexts/WingmanContext";
import { Box, Text } from "ink";

export function CommandExecuteTool({ message }: { message: Message }) {
	const command = message.args?.command as string;

	return (
		<Box flexDirection="column">
			<Box>
				<Text color="cyan">Executing command - {command}</Text>
			</Box>
		</Box>
	);
}
