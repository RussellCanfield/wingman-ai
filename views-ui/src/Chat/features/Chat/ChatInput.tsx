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
	const chatInputBox = useAutoFocus<HTMLTextAreaElement>();

	useEffect(() => {
		if (isVisible) {
			chatInputBox.current?.focus();
		}
	}, [isVisible]);

	const inputClasses = isLightTheme
		? "bg-white text-black border-slate-300"
		: "bg-stone-800 text-white border-stone-700";

	const handleUserInput = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
		if (!inputValue.trim()) return;

		if (e.key === "Enter" && !e.shiftKey) {
			e.preventDefault();

			onChatSubmitted(inputValue);
			chatInputBox.current!.value = "";
		}
	};

	return (
		<div
			className="flex-basis-50 py-3 flex flex-col items-stretch"
			ref={ref}
		>
			<div className="relative flex flex-row items-center">
				<div className={`w-full ${inputClasses} relative`}>
					<div className="flex flex-wrap items-center p-2">
						<textarea
							placeholder="Type here to chat with your Wingman."
							onChange={(e) => setInputValue(e.target.value)}
							onInput={handleAutoResize}
							tabIndex={0}
							rows={1}
							autoFocus
							className={`flex-grow bg-transparent outline-none resize-none focus:ring-2 focus:ring-stone-600 overflow-hidden h-auto p-1`}
							style={{ minHeight: "36px", outline: "none" }}
							onKeyDown={handleUserInput}
						/>
					</div>
				</div>
				<span className="p-4">
					{!loading && (
						<FaPlay
							size={16}
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
							role="presentation"
							title="Cancel chat"
							className="cursor-pointer"
							onClick={onChatCancelled}
						/>
					)}
				</span>
			</div>
		</div>
	);
};

export { ChatInput };
