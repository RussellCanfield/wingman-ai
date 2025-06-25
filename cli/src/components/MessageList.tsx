import type React from "react";
import { memo } from "react";
import { Box, Text } from "ink";
import Markdown from "./Markdown";
import Spinner from "./Spinner";
import { ReadFileTool } from "./tools/ReadFileTool";
import { ListDirectoryTool } from "./tools/ListDirectory";
import { CommandExecuteTool } from "./tools/CommandExecuteTool";
import { EditFileTool } from "./tools/EditFileTool";
import type { Message } from "src/contexts/types";
import { WebSearchTool } from "./tools/WebSearch";

interface Props {
	messages: Message[];
}

const UserMessage: React.FC<{ content: string }> = ({ content }) => (
	<Box flexDirection="column" marginBottom={0.5}>
		<Box paddingX={-0.5} paddingY={0.5}>
			<Text color="green" bold>
				{" "}
				You{" "}
			</Text>
		</Box>
		<Box
			borderLeft
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

const AssistantMessage: React.FC<{ content: string }> = ({ content }) => (
	<Box flexDirection="column" marginBottom={0.5}>
		<Box paddingX={-0.5} paddingY={0.5}>
			<Text color="blue" bold>
				{" "}
				Wingman{" "}
			</Text>
		</Box>
		<Box
			borderLeft
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

const ToolMessage: React.FC<{ msg: Message }> = ({ msg }) => (
	<Box flexDirection="column" marginBottom={0.5}>
		<Box paddingX={-0.5} paddingY={0.5}>
			<Text color="gray" bold>
				{" "}
				Tool{" "}
			</Text>
		</Box>
		<Box
			borderLeft
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

const ToolHandler: React.FC<{ msg: Message }> = ({ msg }) => {
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

const MessageList: React.FC<Props> = ({ messages }) => (
	<Box flexDirection="column" gap={0.5}>
		{messages.map((msg) => (
			<MemoizedMessageItem key={msg.id} msg={msg} />
		))}
	</Box>
);

export default memo(MessageList);
