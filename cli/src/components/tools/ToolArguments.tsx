import type React from "react";
import { Box, Text } from "ink";
import Markdown from "../Markdown";

interface ToolArgumentsProps {
	args: Record<string, unknown> | undefined;
}

const ToolArguments: React.FC<ToolArgumentsProps> = ({ args }) => {
	if (!args) {
		return null;
	}

	const formatObject = (obj: Record<string, unknown>): string => {
		return Object.entries(obj)
			.map(([key, value]) => {
				const formattedValue = typeof value === "string" ? `"${value}"` : value;
				return `  ${key}: ${formattedValue}`;
			})
			.join(",\n");
	};

	const markdownContent = `\`\`\`json\n{\n${formatObject(args)}\n}\n\`\`\``;

	return (
		<Box>
			<Markdown>{markdownContent}</Markdown>
		</Box>
	);
};

export default ToolArguments;
