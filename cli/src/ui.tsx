import React from "react";
import { Box, Text, useApp } from "ink";
import MessageList from "./components/MessageList";
import UserInput from "./components/UserInput";
import { wingmanArt } from "./art";
import { Status, useWingman } from "./contexts/WingmanContext";
import Spinner from "ink-spinner";

const UI: React.FC = () => {
	const { messages, status, input, setInput, handleSubmit } = useWingman();
	const { exit } = useApp();

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

	return (
		<Box flexDirection="column" padding={1}>
			<Box>
				<Text>{wingmanArt}</Text>
			</Box>
			<Box>
				<Text color="blue">Your AI-powered partner</Text>
			</Box>
			<Box flexDirection="column" flexGrow={1} marginTop={1}>
				<MessageList messages={messages} />
				{isThinking && (
					<Box>
						<Spinner type="dots" />
					</Box>
				)}
				{isIdle && (
					<UserInput
						input={input}
						setInput={setInput}
						onSubmit={(value) => handleSubmit(value)}
						isThinking={isThinking || isExecutingTool}
					/>
				)}
			</Box>
		</Box>
	);
};

export default UI;
