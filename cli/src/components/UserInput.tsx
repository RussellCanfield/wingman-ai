 import type React from "react";
import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { Box, Text, useInput, useStdin } from "ink";
import type { WingmanRequest } from "@wingman-ai/agent";
import { useWingman } from "../contexts/WingmanContext";
import { inputLogger, logInputEvent } from "../utils/logger";
import os from "node:os";

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
	{
		name: "/init",
		description:
			"Have Wingman generate a new instructions document to learn your project",
	},
];

const UserInput: React.FC<Props> = ({
	input,
	setInput,
	onSubmit,
	isThinking,
}) => {
	const [showCommands, setShowCommands] = useState(false);
	const [filteredCommands, setFilteredCommands] = useState(commands);
	const [cursorPosition, setCursorPosition] = useState(0);
	const { clearContext } = useWingman();
	const isMac = os.platform() === "darwin";
	const [showCursor, setShowCursor] = useState(true);
	const { stdin, setRawMode } = useStdin();

	// Use refs to track state without causing re-renders
	const isActiveRef = useRef(!isThinking);
	const cursorTimerRef = useRef<NodeJS.Timeout | null>(null);

	// Update active state ref
	useEffect(() => {
		isActiveRef.current = !isThinking;
	}, [isThinking]);

	// Optimized raw mode handling - only set when actually needed
	useEffect(() => {
		if (!isThinking) {
			// Small delay to avoid conflicts with terminal scrolling
			const timer = setTimeout(() => {
				if (isActiveRef.current) {
					setRawMode(true);
				}
			}, 50);

			return () => {
				clearTimeout(timer);
				setRawMode(false);
			};
		}
	}, [isThinking, setRawMode]);

	// Optimized keyboard event handling for Home/End keys
	useEffect(() => {
		const handleData = (data: Buffer) => {
			if (!isActiveRef.current) return;

			const key = data.toString("utf8");

			if (key === "\x1b[H") {
				// Home key
				setCursorPosition(0);
			} else if (key === "\x1b[F") {
				// End key
				setCursorPosition(input.length);
			}
		};

		if (!isThinking && stdin) {
			stdin.on("data", handleData);
			return () => {
				stdin.off("data", handleData);
			};
		}
	}, [stdin, isThinking, input.length]);

	// Reduced logging frequency
	useEffect(() => {
		if (process.env.NODE_ENV === 'development') {
			inputLogger.debug({
				event: 'handler_state_change',
				isActive: !isThinking,
				isThinking,
				reason: isThinking ? 'thinking_mode' : 'input_mode'
			}, `Input handler ${!isThinking ? 'activated' : 'deactivated'}`);
		}
	}, [isThinking]);

	// Optimized cursor position sync
	useEffect(() => {
		if (cursorPosition > input.length) {
			const newPos = input.length;
			setCursorPosition(newPos);
		}
	}, [input.length, cursorPosition]);

	// Optimized cursor blinking - slower interval and better cleanup
	useEffect(() => {
		// Clear any existing timer
		if (cursorTimerRef.current) {
			clearInterval(cursorTimerRef.current);
			cursorTimerRef.current = null;
		}

		if (isThinking) {
			setShowCursor(false);
			return;
		}

		setShowCursor(true);
		// Slower blink rate to reduce re-renders
		cursorTimerRef.current = setInterval(() => {
			if (isActiveRef.current) {
				setShowCursor((v) => !v);
			}
		}, 800); // Increased from 500ms to 800ms

		return () => {
			if (cursorTimerRef.current) {
				clearInterval(cursorTimerRef.current);
				cursorTimerRef.current = null;
			}
		};
	}, [isThinking]);

	const handleOnSubmit = useCallback(
		(value: string) => {
			if (process.env.NODE_ENV === 'development') {
				inputLogger.info({
					event: 'submit',
					value,
					length: value.length
				}, 'Submitting user input');
			}

			let cleanValue = value.trim();

			if (
				cleanValue === "/hotkeys" ||
				cleanValue === "/resume" ||
				cleanValue === "/init"
			) {
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
				setCursorPosition(0);
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
		},
		[clearContext, onSubmit, setInput],
	);

	// Optimized input handler with reduced logging
	const inputHandler = useCallback(
		(inputChar: string, key: any) => {
			// Let global handler process shortcuts
			if (key.ctrl) {
				return;
			}

			// Handle Enter
			if (key.return) {
				handleOnSubmit(input);
				setInput("");
				setCursorPosition(0);
				return;
			}

			// Handle arrow key navigation
			if (key.leftArrow) {
				const newPos = Math.max(0, cursorPosition - 1);
				setCursorPosition(newPos);
				return;
			}

			if (key.rightArrow) {
				const newPos = Math.min(input.length, cursorPosition + 1);
				setCursorPosition(newPos);
				return;
			}

			// Handle backspace
			const isBackspace = key.backspace || (isMac && key.delete);
			if (isBackspace) {
				if (cursorPosition > 0) {
					const newInput = input.slice(0, cursorPosition - 1) + input.slice(cursorPosition);
					setInput(newInput);
					setCursorPosition(cursorPosition - 1);
				}
				return;
			}

			// Handle Delete key (forward delete on non-Macs)
			if (key.delete && !isMac) {
				if (cursorPosition < input.length) {
					const newInput = input.slice(0, cursorPosition) + input.slice(cursorPosition + 1);
					setInput(newInput);
				}
				return;
			}

			// Handle regular character input AND paste operations
			if (inputChar && inputChar.length > 0 && !key.ctrl && !key.meta) {
				const newInput = input.slice(0, cursorPosition) + inputChar + input.slice(cursorPosition);
				const newCursorPosition = cursorPosition + inputChar.length;

				setInput(newInput);
				setCursorPosition(newCursorPosition);
				return;
			}
		},
		[
			isMac,
			input,
			setInput,
			handleOnSubmit,
			cursorPosition,
			isThinking,
		],
	);

	useInput(inputHandler, { isActive: !isThinking });

	// Optimized command suggestions with better memoization
	const commandSuggestions = useMemo(() => {
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
				return matchingCommands;
			}
		}
		return null;
	}, [input]);

	// Update command display state only when suggestions change
	useEffect(() => {
		const hasCommands = commandSuggestions !== null;
		if (showCommands !== hasCommands) {
			setShowCommands(hasCommands);
		}
		if (hasCommands && commandSuggestions) {
			setFilteredCommands(commandSuggestions);
		}
	}, [commandSuggestions, showCommands]);

	// Heavily optimized rendered input with better memoization
	const renderedInput = useMemo(() => {
		if (input.length === 0) {
			return showCursor && !isThinking ? <Text color="blue">█</Text> : <Text> </Text>;
		}

		const beforeCursor = input.slice(0, cursorPosition);
		const afterCursor = input.slice(cursorPosition);

		return (
			<>
				<Text>{beforeCursor}</Text>
				{showCursor && !isThinking && <Text color="blue">█</Text>}
				<Text>{afterCursor}</Text>
			</>
		);
	}, [input, cursorPosition, showCursor, isThinking]);

	// Memoized command display
	const commandDisplay = useMemo(() => {
		if (!showCommands || filteredCommands.length === 0) return null;

		return (
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
		);
	}, [showCommands, filteredCommands]);

	return (
		<Box flexDirection="column">
			{commandDisplay}
			<Box borderStyle="round" borderColor="gray" paddingX={1}>
				{renderedInput}
			</Box>
		</Box>
	);
};

export default UserInput;
