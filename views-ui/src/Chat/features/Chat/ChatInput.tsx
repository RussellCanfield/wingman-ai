import { VSCodeTextArea } from "@vscode/webview-ui-toolkit/react";
import { useEffect, useRef } from "react";
import { FaPlay, FaStopCircle } from "react-icons/fa";

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
	const chatInputBox = useRef<any>(null);

	useEffect(() => {
		chatInputBox.current?.focus();
	}, [chatInputBox]);

	const handleUserInput = (e: React.KeyboardEvent<HTMLInputElement>) => {
		if (e.key === "Enter") {
			if (e.shiftKey) {
				return;
			}

			const element = e.target as HTMLInputElement;
			const message = element.value;

			if (!message) {
				return;
			}

			e.preventDefault();

			onChatSubmitted(message);

			element.value = "";
		}
	};

	return (
		<div className="flex-basis-50 py-3 flex flex-row items-center">
			<VSCodeTextArea
				placeholder="Type here to chat with the extension"
				ref={chatInputBox}
				tabIndex={0}
				className="w-full"
				style={{ "--input-height": "36" } as React.CSSProperties}
				onKeyDown={handleUserInput}
			/>
			<span className="p-4">
				{!loading && (
					<FaPlay
						size={16}
						role="presentation"
						title="Send message"
						className="cursor-pointer"
						onClick={() =>
							handleUserInput({
								key: "Enter",
								preventDefault: () => {},
								target: chatInputBox.current,
							} as unknown as React.KeyboardEvent<HTMLInputElement>)
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
	);
};

export { ChatInput };
