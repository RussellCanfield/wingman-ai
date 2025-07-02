import type React from "react";
import { memo } from "react";
import { Box, Text } from "ink";
import Markdown from "./Markdown";
import { Spinner } from "./Spinner";
import { ReadFileTool } from "../cli/streaming/tools/ReadFileTool";
import { ListDirectoryTool } from "../cli/streaming/tools/ListDirectory";
import { CommandExecuteTool } from "../cli/streaming/tools/CommandExecuteTool";
import { EditFileTool } from "../cli/streaming/tools/EditFileTool";
import type { Message } from "src/contexts/types";
import { WebSearchTool } from "../cli/streaming/tools/WebSearch";

interface Props {
	messages: Message[];
}

const UserMessage: React.FC<{ content: string }> = ({ content }) => (
	<Box flexDirection="column" marginBottom={2}>
		<Box marginBottom={1}>
			<Text color="green" bold>
				▶ You
			</Text>
		</Box>
		<Box paddingLeft={2}>
			<Text color="white">{content}</Text>
		</Box>
	</Box>
);

const AssistantMessage: React.FC<{ content: string }> = ({ content }) => (
	<Box flexDirection="column" marginBottom={2}>
		<Box marginBottom={1}>
			<Text color="blue" bold>
				▶ Wingman
			</Text>
		</Box>
		<Box paddingLeft={2}>
			<Markdown>{content}</Markdown>
		</Box>
	</Box>
);

const ToolMessage: React.FC<{ msg: Message }> = ({ msg }) => (
	<Box flexDirection="column" marginBottom={2}>
		<Box marginBottom={1}>
			<Text color="gray" bold>
				▶ Tool
			</Text>
		</Box>
		<Box paddingLeft={2}>
			<ToolHandler msg={msg} />
		</Box>
	</Box>
);

const ToolHandler: React.FC<{ msg: Message }> = ({ msg }) => {
	if (msg.toolStatus === "executing") {
		return (
			<Box flexDirection="row" gap={1}>
				<Spinner />
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
		if (msg.toolName?.includes("edit_file")) {
			return <EditFileTool message={msg} />;
		}
		if (msg.toolName?.includes("web_search")) {
			return (
				<WebSearchTool message={msg} />
			);
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

const MemoizedUserMessage = memo(UserMessage);
const MemoizedAssistantMessage = memo(AssistantMessage);
const MemoizedToolMessage = memo(ToolMessage);

const MessageItem: React.FC<{ msg: Message }> = ({ msg }) => {
	switch (msg.type) {
		case "human":
			return <MemoizedUserMessage content={msg.content} />;
		case "ai":
			return <MemoizedAssistantMessage content={msg.content} />;
		case "tool":
			return <MemoizedToolMessage msg={msg} />;
		default:
			return null;
	}
};

export const MemoizedMessageItem = memo(MessageItem);

const MessageList: React.FC<Props> = ({ messages }) => {
	if (messages.length === 0) {
		return (
			<Box justifyContent="center" alignItems="center" paddingY={4}>
				<Text color="gray" dimColor>
					Welcome! Ask me anything to get started.
				</Text>
			</Box>
		);
	}

	return (
		<Box flexDirection="column" paddingY={1}>
			{messages.map((msg, index) => (
				<Box key={msg.id}>
					<MemoizedMessageItem msg={msg} />
					{/* Add separator between messages except for the last one */}
					{index < messages.length - 1 && (
						<Box marginBottom={1}>
							<Text color="gray" dimColor>
								{"─".repeat(60)}
							</Text>
						</Box>
					)}
				</Box>
			))}
		</Box>
	);
};

export default memo(MessageList);