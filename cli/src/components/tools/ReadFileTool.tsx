import type { Message } from "src/contexts/types";
import { Box, Text } from "ink";
import Markdown from "../Markdown";

export function ReadFileTool({ message }: { message: Message }) {
	const filePath = message.args?.path as string;

	return (
		<Box flexDirection="row" gap={1}>
			<Text color="cyan">Reading file - </Text>
			<Markdown>{`\`${filePath}\n\``}</Markdown>
		</Box>
	);
}
