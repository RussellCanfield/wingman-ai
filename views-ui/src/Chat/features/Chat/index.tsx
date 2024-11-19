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
		<main className="h-full flex flex-col overflow-auto text-base justify-between">
			{messages.length === 0 && (
				<p className="text-center max-w-2xl px-8 py-6 bg-gradient-to-br from-slate-800/40 to-slate-900/40 rounded-xl border border-slate-700/50 shadow-lg backdrop-blur-sm mx-auto">
					<div
						id="wingman-logo"
						role="img"
						aria-label="Wingman Logo"
						className="h-16 w-16 sm:h-32 sm:w-32 bg-no-repeat bg-contain bg-center mb-6 mx-auto my-4"
					/>
					<span className="block text-xl font-semibold mb-4 bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
						Wingman-AI
					</span>
					<span className="text-slate-300 leading-relaxed">
						The chat feature allows you to ask general or specific
						questions about your codebase. You can also target specific
						context by opening a file, or highlighting sections of a
						file.
						<br />
						<br />
						Chat now features commands! We currently support a code
						review command: "/review". More will be added in the future.
					</span>
				</p>
			)}
			{messages.length > 0 && (<ChatResponseList messages={messages}>
				{loading && (
					<ChatEntry
						from="assistant"
						message={activeMessage?.message || ""}
						context={activeMessage?.context}
						loading={loading}
					/>
				)}
			</ChatResponseList>)}
			<ChatInput
				loading={loading}
				onChatSubmitted={handleChatSubmitted}
				onChatCancelled={cancelAIResponse}
			/>
		</main>
	);
}
