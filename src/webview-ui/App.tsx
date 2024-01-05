import { vscode } from "./utilities/vscode";
import { useEffect, useState } from "react";
import { AppMessage, ChatMessage, CodeContext } from "../types/Message";
import ChatEntry from "./ChatEntry";
import styled from "styled-components";
import { VscClearAll } from "react-icons/vsc";
import { ChatResponseList } from "./ChatList";
import { ChatInput } from "./ChatInput";

const Main = styled.main`
	height: 100%;
	display: flex;
	flex-direction: column;
`;

const ChatToolbar = styled.div`
	display: flex;
	justify-content: space-between;
	align-items: center;
`;

let currentMessage = "";
let currentContext: CodeContext | undefined;

const App = () => {
	const [loading, setLoading] = useState<boolean>(false);
	const [messages, setMessages] = useState<ChatMessage[]>([]);
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
						from: "Assistant",
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
						from: "Assistant",
						...activeMessage,
						message: currentMessage,
						context: currentContext,
					} satisfies ChatMessage;
				});
				break;
			default:
				break;
		}
	};

	const commitMessageToHistory = () => {
		setMessages((messages) => [
			...messages,
			{
				from: "Assistant",
				message: currentMessage,
				loading: false,
				context: currentContext,
			},
		]);

		setLoading(false);
		setActiveMessage((message) => {
			return {
				from: "Assistant",
				context: undefined,
				message: "",
				...message,
				loading: false,
			};
		});

		currentMessage = "";
		currentContext = undefined;
	};

	const cancelAIResponse = () => {
		vscode.postMessage({
			command: "cancel",
		});
		commitMessageToHistory();
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
				from: "User",
				message: input,
				context: undefined,
			},
		]);

		setLoading(true);
	};

	const handleClearChat = () => {
		currentMessage = "";
		setActiveMessage(undefined);
		setMessages([]);

		vscode.postMessage({
			command: "clear",
		});
	};

	return (
		<Main>
			<ChatToolbar>
				<h2>WingMan</h2>
				<VscClearAll
					size={24}
					role="presentation"
					title="Clear chat history"
					onClick={handleClearChat}
				/>
			</ChatToolbar>
			<ChatResponseList messages={messages}>
				{loading && (
					<ChatEntry
						from="Assistant"
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
		</Main>
	);
};

export default App;
