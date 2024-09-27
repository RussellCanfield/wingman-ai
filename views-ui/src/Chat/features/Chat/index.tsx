import { AppMessage, ChatMessage, CodeContext } from "@shared/types/Message";
import { useEffect, useState } from "react";
import { vscode } from "../../utilities/vscode";
import { ChatResponseList } from "./ChatList";
import ChatEntry from "./ChatEntry";
import { ChatInput } from "./ChatInput";
import { useAppContext } from "../../context";

let currentMessage = "";
let currentContext: CodeContext | undefined;

export default function Chat() {
	const { messages, setMessages } = useAppContext();
	const [loading, setLoading] = useState<boolean>(false);
	const [activeMessage, setActiveMessage] = useState<
		ChatMessage | undefined
	>();

	useEffect(() => {
		window.addEventListener("message", handleResponse);

		return () => {
			window.removeEventListener("message", handleResponse);
		};
	}, []);

	const handleResponse = (event: MessageEvent<AppMessage>) => {
		const { data } = event;
		const { command, value } = data;

		switch (command) {
			case "response":
				if (!value) {
					return;
				}

				currentMessage += value as string;
				setActiveMessage((activeMessage) => {
					return {
						loading: true,
						context: undefined,
						from: "assistant",
						...activeMessage,
						message: currentMessage,
					} satisfies ChatMessage;
				});
				break;
			case "done":
				commitMessageToHistory();
				break;
			case "context":
				currentContext = value as CodeContext;
				setActiveMessage((activeMessage) => {
					return {
						loading: true,
						from: "assistant",
						...activeMessage,
						message: currentMessage,
						context: currentContext,
					} satisfies ChatMessage;
				});
				break;
		}
	};

	const commitMessageToHistory = () => {
		const tempMessage = structuredClone(currentMessage.toString());
		const tempContext = structuredClone(currentContext);
		setMessages((messages) => {
			const newHistory: ChatMessage[] = [
				...messages,
				{
					from: "assistant",
					message: tempMessage,
					loading: false,
					context: tempContext,
				},
			];

			return newHistory;
		});

		clearMessage();
	};

	const cancelAIResponse = () => {
		commitMessageToHistory();
		clearMessage();
		vscode.postMessage({
			command: "cancel",
		});
	};

	const clearMessage = () => {
		setLoading(false);
		setActiveMessage(() => {
			return {
				from: "assistant",
				context: undefined,
				message: "",
				loading: false,
			};
		});

		currentMessage = "";
		currentContext = undefined;
	};

	const fetchAIResponse = (text: string) => {
		currentMessage = "";

		vscode.postMessage({
			command: "chat",
			value: text,
		});
	};

	const handleChatSubmitted = (input: string) => {
		fetchAIResponse(input);

		setMessages((messages) => [
			...messages,
			{
				from: "user",
				message: input,
				context: undefined,
			},
		]);

		setLoading(true);
	};

	return (
		<main className="h-full flex flex-col overflow-auto">
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
