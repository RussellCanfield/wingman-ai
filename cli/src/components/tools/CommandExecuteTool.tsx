import type { Message } from "../../contexts/WingmanContext";
import { Box, Text } from "ink";
import Markdown from "../Markdown";

export function CommandExecuteTool({ message }: { message: Message }) {
	const command = message.args?.command as string;

	return (
		<Box flexDirection="column" gap={1}>
			<Text color="cyan">Executing command</Text>
			<Markdown>{`\`\`\`bash\n${command}\n\`\`\``}</Markdown>
		</Box>
	);
}
