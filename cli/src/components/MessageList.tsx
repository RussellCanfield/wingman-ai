import type React from "react";
import { Box, Text } from "ink";
import type { Message } from "../contexts/WingmanContext";
import Spinner from "./Spinner";
import { ReadFileTool } from "./tools/ReadFileTool";
import { ListDirectoryTool } from "./tools/ListDirectory";

interface Props {
	messages: Message[];
}

const MessageList: React.FC<Props> = ({ messages }) => {
	return (
		<Box flexDirection="column">
			{messages.map((msg) => {
				return (
					<Box key={msg.id} flexDirection="column" marginBottom={1}>
						{msg.type === "human" && (
							<Box>
								<Text color="green">You: </Text>
								<Text>{msg.content}</Text>
							</Box>
						)}
						{msg.type === "ai" && (
							<Box>
								<Text color="blue">Wingman: </Text>
								<Text>{msg.content}</Text>
							</Box>
						)}
						{msg.type === "tool" && (
							<Box>
								<ToolHandler msg={msg} />
							</Box>
						)}
					</Box>
				);
			})}
		</Box>
	);
};

const ToolHandler = ({ msg }: { msg: Message }) => {
	// use switch case for different tool types
	if (msg.toolStatus === "executing") {
		return (
			<Box>
				<Spinner status="ExecutingTool" />
				<Text color="yellow"> Executing tool - {msg.toolName}</Text>
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
	}

	return (
		<Box flexDirection="column">
			<Box>
				<Text color="cyan"> Executed tool - {msg.toolName}</Text>
			</Box>
		</Box>
	);
};

export default MessageList;
