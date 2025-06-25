import type { Message } from "src/contexts/types";
import { Box, Text } from "ink";
import Markdown from "../Markdown";

export function WebSearchTool({ message }: { message: Message }) {
	const url = message.args?.url as string;

	return (
		<Box flexDirection="row" gap={1}>
			<Text color="cyan">🌐 Crawled url - </Text>
			<Markdown>{`\`${url}\n\``}</Markdown>
		</Box>
	);
}
