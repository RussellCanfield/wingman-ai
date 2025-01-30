import { vscode } from "../../utilities/vscode";
import { ChatResponseList } from "./ChatList";
import ChatEntry from "./ChatEntry";
import { ChatInput } from "./ChatInput";
import { useChatContext } from "../../context/chatContext";

export default function Chat() {
	const { messages, addMessage, activeMessage, clearActiveMessage, loading, setLoading } = useChatContext();

	const cancelAIResponse = () => {
		clearActiveMessage(true);
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
				<div className="flex items-center justify-center h-full p-4">
					<div className="text-center max-w-2xl p-8 bg-[var(--vscode-input-background)] rounded-2xl border border-slate-700/30 shadow-2xl backdrop-blur-md mx-auto transition-all duration-300 hover:border-slate-700/50">
						<div
							id="wingman-logo"
							role="img"
							aria-label="Wingman Logo"
							className="h-16 w-16 sm:h-24 sm:w-24 bg-no-repeat bg-contain bg-center mb-8 mx-auto animate-fade-in"
						/>
						<h1 className="text-2xl font-semibold mb-6 bg-gradient-to-r from-blue-400 via-white to-blue-200 bg-clip-text text-transparent animate-gradient">
							Welcome to Wingman-AI
						</h1>
						<div className="space-y-4 text-[var(--vscode-input-foreground)] leading-relaxed">
							<p className="opacity-90">
								Ask questions about your codebase or get help with specific code sections.
								Simply open a file or highlight code to provide more context.
							</p>
							<div className="inline-block mt-6 px-4 py-2 rounded-lg bg-slate-700/20 border border-slate-700/40">
								<p className="flex items-center gap-2 text-sm">
									<span className="text-blue-400">Pro tip:</span>
									Type <kbd className="px-2 py-0.5 rounded bg-slate-700/30">/</kbd> to access commands
								</p>
							</div>
						</div>
					</div>
				</div>
			)}
			{messages.length > 0 && (
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
			)}
			<ChatInput
				loading={loading}
				onChatSubmitted={handleChatSubmitted}
				onChatCancelled={cancelAIResponse}
			/>
		</main>
	);
}
