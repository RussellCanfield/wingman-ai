import { FaPlay, FaStopCircle } from "react-icons/fa";
import { useAppContext } from "../../context";
import { useAutoFocus } from "../../hooks/useAutoFocus";
import { useOnScreen } from "../../hooks/useOnScreen";
import { useEffect, useState } from "react";
import { handleAutoResize } from "../../utilities/utils";

interface ChatInputProps {
	onChatSubmitted: (input: string) => void;
	onChatCancelled: () => void;
	loading: boolean;
}

const ChatInput = ({
	loading,
	onChatSubmitted,
	onChatCancelled,
}: ChatInputProps) => {
	const [ref, isVisible] = useOnScreen();
	const { isLightTheme } = useAppContext();
	const [inputValue, setInputValue] = useState("");
	const chatInputBox = useAutoFocus();

	useEffect(() => {
		if (isVisible) {
			chatInputBox.current?.focus();
		}
	}, [isVisible]);

	const handleUserInput = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
		if (!inputValue.trim() || loading) return;

		if (e.key === "Enter" && !e.shiftKey) {
			e.preventDefault();

			onChatSubmitted(inputValue);
			setInputValue("");
			handleAutoResize(e.target as HTMLTextAreaElement, true);
		}
	};

	return (
		<div
			className="flex-basis-50 py-3 flex flex-col items-stretch"
			ref={ref}
		>
			<div className="relative flex flex-row items-center">
				<div className="w-full relative">
					<div className="flex flex-wrap items-center p-2">
						<textarea
							placeholder="Type here to chat with your Wingman."
							onChange={(e) => {
								setInputValue(e.target.value);
								handleAutoResize(e.target);
							}}
							value={inputValue}
							tabIndex={0}
							rows={1}
							autoFocus
							className="flex-grow resize-none text-[var(--vscode-input-foreground)] border border-[var(--vscode-input-border)] bg-[var(--vscode-input-background)] rounded-md focus:outline-none focus:ring-2 focus:ring-[var(--vscode-focusBorder)] overflow-y-auto min-h-[36px] p-2"
							style={{ minHeight: "36px", outline: "none" }}
							onKeyDown={handleUserInput}
						/>
						<span className="p-4 pr-0">
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
										handleUserInput({
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
	);
};

export { ChatInput };
