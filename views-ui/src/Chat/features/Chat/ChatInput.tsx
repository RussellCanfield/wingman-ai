import { FaPlay, FaStopCircle } from "react-icons/fa";
import { useAutoFocus } from "../../hooks/useAutoFocus";
import { useOnScreen } from "../../hooks/useOnScreen";
import { useEffect, useState, useRef, useMemo } from "react";
import { handleAutoResize } from "../../utilities/utils";
import { CommandDropdown } from "./CommandDropdown";
import { AVAILABLE_COMMANDS } from "./types";
import { useSettingsContext } from "../../context/settingsContext";

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
	const { isLightTheme } = useSettingsContext();
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

	const filteredCommands = useMemo(() => {
		if (!inputValue || inputValue === '/') return AVAILABLE_COMMANDS;
		const searchTerm = inputValue.substring(1).toLowerCase();
		return AVAILABLE_COMMANDS.filter(
			command =>
				command.id.toLowerCase().startsWith(searchTerm)
		);
	}, [AVAILABLE_COMMANDS, inputValue]);

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
		const command = filteredCommands[index];
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
						prev < filteredCommands.length - 1 ? prev + 1 : prev
					);
					break;
				case "ArrowUp":
					e.preventDefault();
					setSelectedIndex((prev) => (prev > 0 ? prev - 1 : prev));
					break;
				case "Enter":
					e.preventDefault();
					if (selectedIndex >= 0 && selectedIndex < filteredCommands.length) {
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

	const inputContainerClass = `
		relative flex flex-col items-stretch p-4 
		${isLightTheme
			? 'bg-white shadow-[0_2px_4px_rgba(0,0,0,0.1),0_8px_16px_rgba(0,0,0,0.1)] hover:shadow-[0_4px_8px_rgba(0,0,0,0.15),0_12px_24px_rgba(0,0,0,0.15)]'
			: 'bg-[#1e1e1e] shadow-[0_2px_4px_rgba(0,0,0,0.2),0_8px_16px_rgba(0,0,0,0.2)] hover:shadow-[0_4px_8px_rgba(0,0,0,0.25),0_12px_24px_rgba(0,0,0,0.25)]'
		}
		transition-shadow duration-300 ease-in-out rounded-xl
	`;

	const textareaClass = `
		flex-grow resize-none text-[var(--vscode-input-foreground)]
		focus:outline-none outline-none bg-transparent overflow-y-auto min-h-[36px] p-2 transition-all duration-200
	`;

	const buttonContainerClass = `
		flex justify-between items-center gap-2 pt-4 h-[52px]
	`;

	const iconButtonClass = `
		rounded-lg transition-all duration-200 flex items-center gap-2
		${isLightTheme
			? 'hover:bg-gray-100 active:bg-gray-200'
			: 'hover:bg-gray-800 active:bg-gray-700'
		}
	`;

	return (
		<div className="flex-basis-50 py-3 flex flex-col items-stretch" ref={ref}>
			<div className={inputContainerClass}>
				{isCommandMode && (
					<CommandDropdown
						commands={filteredCommands}
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
				<textarea
					ref={inputRef}
					placeholder="Type here to chat, use / for commands..."
					onChange={(e) => {
						setInputValue(e.target.value);
						handleCommandInput(e.target.value);
						handleAutoResize(e.target);
					}}
					value={inputValue}
					tabIndex={0}
					rows={1}
					autoFocus
					className={textareaClass}
					onKeyDown={handleKeyDown}
				/>
				<div className={buttonContainerClass}>
					<span className={`font-medium ${isLightTheme ? 'text-gray-600' : 'text-gray-300'}`}>
						{commandMatch ? (
							<>
								<span className="opacity-70">Command:</span>
								<span className="font-semibold ml-2">{`/${selectedCommand}`}</span>
							</>
						) : (
							<span className="opacity-50 text-sm p-2.5">Type / for commands</span>
						)}
					</span>
					{!loading ? (
						<button
							className={`${iconButtonClass} ${!inputValue.trim() ? 'opacity-50 cursor-not-allowed' : ''} p-2.5`}
							onClick={() =>
								handleKeyDown({
									key: "Enter",
									preventDefault: () => { },
									target: chatInputBox.current,
								} as unknown as React.KeyboardEvent<HTMLTextAreaElement>)
							}
							disabled={!inputValue.trim()}
							title="Send message"
						>
							<FaPlay size={16} />
						</button>
					) : (
						<button
							className={`${iconButtonClass} text-white`}
							onClick={onChatCancelled}
							title="Cancel chat"
						>
							<FaStopCircle size={16} />
						</button>
					)}
				</div>
			</div>
		</div>
	);
};

export { ChatInput };