import { vscode } from "./utilities/vscode";
import { VSCodeTextField } from "@vscode/webview-ui-toolkit/react";
import styled from "styled-components";
import { PropsWithChildren, useEffect, useState } from "react";
import { ModelStream } from "../service/llm";
import { flushSync } from "react-dom";

const Main = styled.main`
	height: 100%;
	display: flex;
	flex-direction: column;
`;

const UserInput = styled.div`
	flex-basis: 60px;
`;

const ChatResponses = styled.div`
	flex: 1 0 auto;
`;

function ChatResponseList({ children }: PropsWithChildren) {
	return <ChatResponses>{children}</ChatResponses>;
}

function ChatResponse({ input }: { input: string }) {
	return (
		<div>
			<p>{input}</p>
		</div>
	);
}

interface AppMessage {
	command: string;
	value: ModelStream;
}

interface ChatMessage {
	from: "bot" | "user";
	message: string;
}

let currentMessage = "";

function App() {
	const [messages, setMessages] = useState<ChatMessage[]>([]);
	const [activeMessage, setActiveMessage] = useState<string>("");

	useEffect(() => {
		window.addEventListener("message", handleResponse);

		return () => {
			window.removeEventListener("message", handleResponse);
		};
	}, []);

	console.log(activeMessage);

	function handleResponse(event: MessageEvent<AppMessage>) {
		const { data } = event;
		const { command, value } = data;

		if (command === "done") {
			console.log("Saving: ", activeMessage);
			setMessages((messages) => [
				...messages,
				{
					from: "bot",
					message: currentMessage,
				},
			]);

			setActiveMessage("");
			currentMessage = "";

			return;
		}

		if (!value) {
			return;
		}

		currentMessage += value;
		setActiveMessage((message) => message + value);
	}

	function fetchAIResponse(text: string) {
		vscode.postMessage({
			command: "chat",
			value: text,
		});
	}

	function handleUserInput(e: React.KeyboardEvent<HTMLInputElement>) {
		if (e.key === "Enter") {
			e.preventDefault();

			const element = e.target as HTMLInputElement;
			const text = element.value;

			fetchAIResponse(text);
			element.value = "";
		}
	}

	return (
		<Main>
			<h2>Code Assistant</h2>
			<ChatResponseList>
				{messages.map(({ from, message }, index) => (
					<ChatResponse key={index} input={message} />
				))}
				{activeMessage && <ChatResponse input={activeMessage} />}
			</ChatResponseList>
			<UserInput>
				<VSCodeTextField
					placeholder="Type here to chat with the extension"
					style={{ width: "100%" }}
					onKeyDown={handleUserInput}
				/>
			</UserInput>
		</Main>
	);
}

export default App;
