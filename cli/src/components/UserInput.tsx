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
	{ name: "/hotkeys", description: "Show available hotkeys" },
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
		if (input.endsWith(" ")) {
			setShowCommands(false);
			return;
		}

		const words = input.split(" ");
		const lastWord = words[words.length - 1];

		if (lastWord?.startsWith("/")) {
			const matchingCommands = commands.filter((cmd) =>
				cmd.name.toLowerCase().startsWith(lastWord.toLowerCase()),
			);

			if (matchingCommands.length > 0) {
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
		if (value.trim() === "/hotkeys") {
			onSubmit({ input: value.trim() });
			return;
		}

		const fileRegex = /\/file\s+([^\s]+)/g;
		const dirRegex = /\/dir\s+([^\s]+)/g;
		const clearRegex = /\/clear/g;

		let cleanValue = value;

		// Handle the /clear command
		if (clearRegex.test(value)) {
			clearContext();
			cleanValue = cleanValue.replace(clearRegex, "").trim();
			if (cleanValue === "") {
				setInput("");
				return;
			}
		}

		// Extract file and directory paths from the input
		const contextFiles = Array.from(value.matchAll(fileRegex), (m) => m[1]);
		const contextDirectories = Array.from(
			value.matchAll(dirRegex),
			(m) => m[1],
		);

		// Remove the command strings from the input
		cleanValue = cleanValue.replace(fileRegex, "").replace(dirRegex, "").trim();

		// Build the request object
		const request: WingmanRequest = {
			input: cleanValue,
		};

		if (contextFiles.length > 0) {
			request.contextFiles = contextFiles;
		}

		if (contextDirectories.length > 0) {
			request.contextDirectories = contextDirectories;
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
