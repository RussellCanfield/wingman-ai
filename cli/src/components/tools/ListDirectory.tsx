import type { Message } from "../../contexts/WingmanContext";
import { Box, Text } from "ink";
import Markdown from "../Markdown";

export function ListDirectoryTool({ message }: { message: Message }) {
	const { directory, depth } = message.args as {
		directory: string;
		depth?: number;
	};

	const content = `Directory: ${directory}\nDepth: ${depth ?? "N/A"}`;

	return (
		<Box flexDirection="column" gap={1}>
			<Text color="cyan">Listing directory</Text>
			<Markdown>{`\`\`\`\n${content}\n\`\`\``}</Markdown>
		</Box>
	);
}
