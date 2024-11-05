import { FaPlay, FaStopCircle } from "react-icons/fa";
import { useAutoFocus } from "../../hooks/useAutoFocus";
import { useOnScreen } from "../../hooks/useOnScreen";
import { useEffect, useState, useRef } from "react";
import { handleAutoResize } from "../../utilities/utils";
import { CommandDropdown } from "./CommandDropdown";
import { useAppContext } from "../../context";
import { AVAILABLE_COMMANDS } from "./types";

interface ChatInputProps {
	onChatSubmitted: (input: string, command?: string) => void;
	onChatCancelled: () => void;
	loading: boolean;
}

const ChatInput = ({
	loading,
	onChatSubmitted,
	onChatCancelled,
}: ChatInputProps) => {
	const { isLightTheme } = useAppContext();
	const [ref, isVisible] = useOnScreen();
	const [inputValue, setInputValue] = useState("");
	const [isCommandMode, setIsCommandMode] = useState(false);
	const [selectedCommand, setSelectedCommand] = useState<string | null>(null);
	const [selectedIndex, setSelectedIndex] = useState(0);
	const chatInputBox = useAutoFocus();
	const inputRef = useRef<HTMLTextAreaElement>(null);

	const commandMatch =
		selectedCommand &&
		AVAILABLE_COMMANDS.some((c) => c.id === selectedCommand);

	useEffect(() => {
		if (isVisible) {
			chatInputBox.current?.focus();
		}
	}, [isVisible]);

	const handleCommandInput = (text: string) => {
		if (text.startsWith("/")) {
			const spaceIndex = text.indexOf(" ");
			if (spaceIndex !== -1) {
				const command = text.substring(1, spaceIndex);
				setSelectedCommand(command);
				setIsCommandMode(false);
			} else {
				setIsCommandMode(true);
				const command = text.substring(1);
				if (command) {
					setSelectedCommand(command);
				} else {
					setSelectedCommand(null);
				}
				setSelectedIndex(0);
			}
		} else {
			setIsCommandMode(false);
			setSelectedCommand(null);
			setSelectedIndex(0);
		}
	};

	const handleCommandSelection = (index: number) => {
		const command = AVAILABLE_COMMANDS[index];
		const newValue = `/${command.id} `;
		setInputValue(newValue);
		setSelectedCommand(command.id);
		setIsCommandMode(false);
		setSelectedIndex(0);
		if (inputRef.current) {
			inputRef.current.focus();
			handleAutoResize(inputRef.current);
		}
	};

	const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
		if (isCommandMode) {
			switch (e.key) {
				case "ArrowDown":
					e.preventDefault();
					setSelectedIndex((prev) =>
						prev < AVAILABLE_COMMANDS.length - 1 ? prev + 1 : prev
					);
					break;
				case "ArrowUp":
					e.preventDefault();
					setSelectedIndex((prev) => (prev > 0 ? prev - 1 : prev));
					break;
				case "Enter":
					e.preventDefault();
					if (selectedIndex >= 0) {
						handleCommandSelection(selectedIndex);
					}
					break;
				case "Escape":
					e.preventDefault();
					setIsCommandMode(false);
					setSelectedIndex(0);
					break;
			}
			return;
		}

		if (!inputValue.trim() || loading) return;

		if (e.key === "Enter" && !e.shiftKey) {
			e.preventDefault();
			let strippedInput = inputValue;
			if (selectedCommand) {
				const commandMatch = `/${selectedCommand} `;
				if (inputValue.startsWith(commandMatch)) {
					strippedInput = inputValue.substring(commandMatch.length);
				}
			}
			onChatSubmitted(strippedInput, selectedCommand || undefined);
			setInputValue("");
			setIsCommandMode(false);
			setSelectedCommand(null);
			setSelectedIndex(0);
			handleAutoResize(e.target as HTMLTextAreaElement, true);
		}
	};

	return (
		<div
			className="flex-basis-50 py-3 flex flex-col items-stretch"
			ref={ref}
		>
			<div className="relative flex flex-row items-center border-2 border-gray-500 rounded-md mb-2">
				{isCommandMode && (
					<CommandDropdown
						commands={AVAILABLE_COMMANDS}
						isLightTheme={isLightTheme}
						visible={isCommandMode}
						selectedIndex={selectedIndex}
						onCommandSelect={(command) => {
							const newValue = `/${command.id} `;
							setInputValue(newValue);
							setSelectedCommand(command.id);
							setIsCommandMode(false);
							setSelectedIndex(0);
							if (inputRef.current) {
								inputRef.current.focus();
								handleAutoResize(inputRef.current);
							}
						}}
					/>
				)}
				<div className="w-full relative">
					<div className="flex flex-wrap items-center">
						<textarea
							ref={inputRef}
							placeholder="Type here to chat with your Wingman. Type / for commands."
							onChange={(e) => {
								setInputValue(e.target.value);
								handleCommandInput(e.target.value);
								handleAutoResize(e.target);
							}}
							value={inputValue}
							tabIndex={0}
							rows={1}
							autoFocus
							className="flex-grow resize-none text-[var(--vscode-input-foreground)] focus:outline-none bg-transparent border-b-2 border-stone-600 overflow-y-auto min-h-[36px] p-2"
							style={{ minHeight: "36px", outline: "none" }}
							onKeyDown={handleKeyDown}
						/>
						<div className="flex w-full justify-between items-center">
							<span className="text-[var(--vscode-editor-foreground)] font-medium flex flex-row gap-1 p-2">
								{commandMatch && (
									<>
										<caption className="italic">
											Command:{" "}
										</caption>
										<span>{`/${selectedCommand}`}</span>
									</>
								)}
							</span>
							<span className="p-4 pr-2">
								{!loading && (
									<FaPlay
										size={16}
										tabIndex={0}
										role="presentation"
										title="Send message"
										className={`${
											!inputValue.trim()
												? "text-gray-500"
												: "text-gray-100"
										} cursor-pointer`}
										onClick={() =>
											handleKeyDown({
												key: "Enter",
												preventDefault: () => {},
												target: chatInputBox.current,
											} as unknown as React.KeyboardEvent<HTMLTextAreaElement>)
										}
									/>
								)}
								{loading && (
									<FaStopCircle
										size={16}
										tabIndex={0}
										role="presentation"
										title="Cancel chat"
										className="cursor-pointer"
										onClick={onChatCancelled}
									/>
								)}
							</span>
						</div>
					</div>
				</div>
			</div>
		</div>
	);
};

export { ChatInput };
