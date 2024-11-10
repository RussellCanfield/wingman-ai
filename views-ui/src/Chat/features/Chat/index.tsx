import { vscode } from "../../utilities/vscode";
import { ChatResponseList } from "./ChatList";
import ChatEntry from "./ChatEntry";
import { ChatInput } from "./ChatInput";
import { useChatContext } from "../../context/chatContext";

export default function Chat() {
	const { messages, addMessage, activeMessage, clearActiveMessage, loading, setLoading } = useChatContext();

	const cancelAIResponse = () => {
		clearActiveMessage();
		vscode.postMessage({
			command: "cancel",
		});
		setLoading(false);
	};

	const handleChatSubmitted = (input: string, command?: string) => {
		vscode.postMessage({
			command: command || "chat",
			value: input,
		});

		addMessage({
			from: "user",
			message: !input ? command || "" : input,
			context: undefined,
			type: "chat",
		});

		setLoading(true);
	};

	return (
		<main className="h-full flex flex-col overflow-auto text-base">
			{messages.length === 0 && (
				<p>
					The chat feature allows you to ask general or specific
					questions about your codebase. You can also target specific
					context by opening a file, or highlighting sections of a
					file.
					<br />
					<br />
					Chat now features commands! We currently support a code
					review command: "/review". More will be added in the future.
				</p>
			)}
			<ChatResponseList messages={messages}>
				{loading && (
					<ChatEntry
						from="assistant"
						message={activeMessage?.message || ""}
						context={activeMessage?.context}
						loading={loading}
					/>
				)}
			</ChatResponseList>
			<ChatInput
				loading={loading}
				onChatSubmitted={handleChatSubmitted}
				onChatCancelled={cancelAIResponse}
			/>
		</main>
	);
}
