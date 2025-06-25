import React from "react";
import { Box, Text, useApp, Static } from "ink";
import MessageList, { MemoizedMessageItem } from "./components/MessageList";
import UserInput from "./components/UserInput";
import { wingmanArt } from "./art";
import { Status, useWingman } from "./contexts/WingmanContext";
import Spinner from "ink-spinner";
import StatusBar from "./components/StatusBar";
import type { WingmanRequest } from "@wingman-ai/agent";
import { useHotkeys } from "./hooks/useHotkeys";

const UI: React.FC = () => {
	const { messages, status, input, handleSubmit } = useWingman();
	const { exit } = useApp();
	const { customSetInput } = useHotkeys();

	React.useEffect(() => {
		const handleExit = () => {
			exit();
		};
		process.on("SIGINT", handleExit);
		return () => {
			process.off("SIGINT", handleExit);
		};
	}, [exit]);

	const isThinking = status === Status.Thinking;
	const isExecutingTool = status === Status.ExecutingTool;
	const isIdle = status === Status.Idle;

	// Separate messages into static and active
	const staticMessages = messages.slice(0, -2);
	const activeMessages = messages.slice(-2);

	return (
		<Box flexDirection="column" padding={1}>
			<Box>
				<Text>{wingmanArt}</Text>
			</Box>
			<Box>
				<Text color="blue">Your AI-powered partner</Text>
			</Box>
			<Box flexGrow={1} flexDirection="column" marginTop={1}>
				<Static items={staticMessages}>
					{(msg) => <MemoizedMessageItem key={msg.id} msg={msg} />}
				</Static>
				<MessageList messages={activeMessages} />
			</Box>
			<Box flexDirection="column">
				{isThinking && (
					<Box>
						<Spinner type="dots" />
					</Box>
				)}
				{isIdle && (
					<UserInput
						input={input}
						setInput={customSetInput}
						onSubmit={(request: WingmanRequest) => handleSubmit(request)}
						isThinking={isThinking || isExecutingTool}
					/>
				)}
				<StatusBar />
			</Box>
		</Box>
	);
};

export default UI;
