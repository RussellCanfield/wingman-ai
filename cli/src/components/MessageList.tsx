import type React from "react";
import { Box, Text } from "ink";
import Markdown from './Markdown';
import type { Message } from "../contexts/WingmanContext";
import Spinner from "./Spinner";
import { ReadFileTool } from "./tools/ReadFileTool";
import { ListDirectoryTool } from "./tools/ListDirectory";
import { CommandExecuteTool } from "./tools/CommandExecuteTool";

interface Props {
	messages: Message[];
}

const MessageList: React.FC<Props> = ({ messages }) => {
	return (
		<Box flexDirection="column" gap={0.5}>
			{messages.map((msg) => {
				return (
					<Box key={msg.id} flexDirection="column">
						{msg.type === "human" && (
							<UserMessage content={msg.content} />
						)}
						{msg.type === "ai" && (
							<AssistantMessage content={msg.content} />
						)}
						{msg.type === "tool" && (
							<ToolMessage msg={msg} />
						)}
					</Box>
				);
			})}
		</Box>
	);
};

const UserMessage: React.FC<{ content: string }> = ({ content }) => {
	return (
		<Box flexDirection="column" marginBottom={0.5}>
			{/* User header */}
			<Box paddingX={-0.5} paddingY={0.5}>
				<Text color="green" bold> You </Text>
			</Box>

			{/* User message content with dark background */}
			<Box
				borderLeft={true}
				borderTop={false}
				borderRight={false}
				borderBottom={false}
				borderColor="green"
				borderStyle="bold"
				paddingX={2}
				paddingY={1}
			>
				<Text color="white">{content}</Text>
			</Box>
		</Box>
	);
};

const AssistantMessage: React.FC<{ content: string }> = ({ content }) => {
	return (
		<Box flexDirection="column" marginBottom={0.5}>
			{/* Assistant header */}
			<Box paddingX={-0.5} paddingY={0.5}>
				<Text color="blue" bold> Wingman </Text>
			</Box>

			{/* Assistant message content with dark background */}
			<Box
				borderLeft={true}
				borderTop={false}
				borderRight={false}
				borderBottom={false}
				borderColor="blue"
				borderStyle="bold"
				paddingX={2}
				paddingY={1}
			>
				<Markdown>{content}</Markdown>
			</Box>
		</Box>
	);
};

const ToolMessage: React.FC<{ msg: Message }> = ({ msg }) => {
	return (
		<Box flexDirection="column" marginBottom={0.5}>
			{/* Tool header */}
			<Box paddingX={-0.5} paddingY={0.5}>
				<Text color="gray" bold> Tool </Text>
			</Box>

			{/* Tool content with dark background */}
			<Box
				borderLeft={true}
				borderTop={false}
				borderRight={false}
				borderBottom={false}
				borderColor="gray"
				borderStyle="bold"
				paddingX={2}
				paddingY={1}
			>
				<ToolHandler msg={msg} />
			</Box>
		</Box>
	);
};

const ToolHandler = ({ msg }: { msg: Message }) => {
	if (msg.toolStatus === "executing") {
		return (
			<Box flexDirection="row" gap={1}>
				<Spinner status="ExecutingTool" />
				<Text color="yellow">Executing {msg.toolName}</Text>
			</Box>
		);
	}

	if (msg.toolStatus === "finished") {
		if (msg.toolName?.includes("list_directory")) {
			return <ListDirectoryTool message={msg} />;
		}

		if (msg.toolName?.includes("read_file")) {
			return <ReadFileTool message={msg} />;
		}

		if (msg.toolName?.includes("command_execute")) {
			return <CommandExecuteTool message={msg} />;
		}

		return (
			<Box flexDirection="column">
				<Text color="green">✓ Completed: {msg.toolName}</Text>
			</Box>
		);
	}

	return (
		<Box flexDirection="column">
			<Text color="cyan">Tool: {msg.toolName}</Text>
		</Box>
	);
};

export default MessageList;