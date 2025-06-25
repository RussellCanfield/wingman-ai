import React from "react";
import { Box, Text, useApp } from "ink";
import MessageList from "./components/MessageList";
import UserInput from "./components/UserInput";
import { wingmanArt } from "./art";
import { useWingman } from "./contexts/WingmanContext";
import Spinner from "ink-spinner";
import StatusBar from "./components/StatusBar";
import type { WingmanRequest } from "@wingman-ai/agent";
import { useHotkeys } from "./hooks/useHotkeys";
import { Status } from "./contexts/types";

const UI: React.FC = () => {
	const { messages, status, input, setInput, handleSubmit } = useWingman();
	const { exit } = useApp();
	useHotkeys();

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
	const isCompacting = status === Status.Compacting;

	return (
		<Box flexDirection="column" padding={1}>
			<Box>
				<Text>{wingmanArt}</Text>
			</Box>
			<Box>
				<Text color="blue">Your AI-powered partner</Text>
			</Box>
			<Box flexGrow={1} flexDirection="column" marginTop={1}>
				<MessageList messages={messages} />
			</Box>
			<Box flexDirection="column">
				{(isThinking || isCompacting) && (
					<Box>
						<Spinner type="dots" />
					</Box>
				)}
				{isIdle && (
					<UserInput
						input={input}
						setInput={setInput}
						onSubmit={(request: WingmanRequest) => handleSubmit(request)}
						isThinking={isThinking || isExecutingTool || isCompacting}
					/>
				)}
				<StatusBar />
			</Box>
		</Box>
	);
};

export default UI;
