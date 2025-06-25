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
	{ name: "/compact", description: "Compact context" },
	{ name: "/resume", description: "Resume the last conversation" },
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
		const trimmedInput = input.trimStart();
		if (
			trimmedInput.startsWith("/") &&
			!trimmedInput.includes(" ") &&
			!trimmedInput.substring(1).includes("/")
		) {
			const matchingCommands = commands.filter((cmd) =>
				cmd.name.toLowerCase().startsWith(trimmedInput.toLowerCase()),
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
		let cleanValue = value.trim();

		if (cleanValue === "/hotkeys" || cleanValue === "/resume") {
			onSubmit({ input: cleanValue });
			return;
		}

		const fileRegex = /^\/file\s+([^\s]+)/;
		const dirRegex = /^\/dir\s+([^\s]+)/;
		const clearRegex = /^\/clear(\s|$)/;

		const contextFiles: string[] = [];
		const contextDirectories: string[] = [];
		let isClear = false;

		let changed = true;
		while (changed) {
			changed = false;
			const fileMatch = cleanValue.match(fileRegex);
			if (fileMatch) {
				contextFiles.push(fileMatch[1]);
				cleanValue = cleanValue.replace(fileRegex, "").trim();
				changed = true;
			}

			const dirMatch = cleanValue.match(dirRegex);
			if (dirMatch) {
				contextDirectories.push(dirMatch[1]);
				cleanValue = cleanValue.replace(dirRegex, "").trim();
				changed = true;
			}

			if (clearRegex.test(cleanValue)) {
				isClear = true;
				cleanValue = cleanValue.replace(clearRegex, "").trim();
				changed = true;
			}
		}

		if (isClear) {
			clearContext();
		}

		if (
			cleanValue === "" &&
			isClear &&
			contextFiles.length === 0 &&
			contextDirectories.length === 0
		) {
			setInput("");
			return;
		}

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
