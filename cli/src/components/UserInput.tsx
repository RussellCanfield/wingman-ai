import type React from "react";
import { useState, useEffect } from "react";
import { Box, Text } from "ink";
import TextInput from "ink-text-input";
import type { WingmanRequest } from "@wingman-ai/agent";
import { useWingman } from "../contexts/WingmanContext";

interface Props {
	input: string;
	setInput: (value: string) => void;
	onSubmit: (request: WingmanRequest) => void;
	isThinking: boolean;
}

const commands = [
	{ name: "/file", description: "Add a file to the context" },
	{ name: "/dir", description: "Add a directory to the context" },
	{ name: "/clear", description: "Clear the context" },
];

const UserInput: React.FC<Props> = ({
	input,
	setInput,
	onSubmit,
	isThinking,
}) => {
	const [showCommands, setShowCommands] = useState(false);
	const [filteredCommands, setFilteredCommands] = useState(commands);
	const { clearContext } = useWingman();

	useEffect(() => {
		if (input.startsWith("/")) {
			const parts = input.split(" ");
			const command = parts[0];
			const hasArgument = parts.length > 1 && parts[1] !== "";

			const matchingCommands = commands.filter((cmd) =>
				cmd.name.toLowerCase().startsWith(command.toLowerCase()),
			);

			if (matchingCommands.length > 0 && !hasArgument) {
				setShowCommands(true);
				setFilteredCommands(matchingCommands);
			} else {
				setShowCommands(false);
			}
		} else {
			setShowCommands(false);
		}
	}, [input]);

	const handleOnSubmit = (value: string) => {
		let request: WingmanRequest;
		if (value.startsWith("/file ")) {
			const filePath = value.split(" ")[1];
			request = {
				input: value,
				contextFiles: [filePath],
			};
		} else if (value.startsWith("/dir ")) {
			const dirPath = value.split(" ")[1];
			request = {
				input: value,
				contextDirectories: [dirPath],
			};
		} else if (value.startsWith("/clear")) {
			clearContext();
			setInput("");
			return;
		} else {
			request = {
				input: value,
			};
		}
		onSubmit(request);
	};

	return (
		<Box flexDirection="column">
			{showCommands && filteredCommands.length > 0 && (
				<Box
					flexDirection="column"
					borderStyle="round"
					padding={1}
					marginBottom={1}
					borderColor="blue"
				>
					<Box marginBottom={1}>
						<Text bold={true}>Commands:</Text>
					</Box>
					{filteredCommands.map((cmd) => (
						<Box key={cmd.name} marginLeft={1}>
							<Text color="cyan">{cmd.name}</Text>
							<Text> - {cmd.description}</Text>
						</Box>
					))}
				</Box>
			)}
			<Box borderStyle="round" borderColor="gray" paddingX={1}>
				<TextInput
					value={input}
					onChange={setInput}
					onSubmit={handleOnSubmit}
				/>
			</Box>
		</Box>
	);
};

export default UserInput;
