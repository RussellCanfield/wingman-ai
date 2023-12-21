import { vscode } from "./utilities/vscode";
import { VSCodeTextField } from "@vscode/webview-ui-toolkit/react";
import { PropsWithChildren, useEffect, useRef, useState } from "react";
import { AppMessage, ChatMessage } from "./types/Message";
import ChatEntry from "./ChatEntry";
import styled from "styled-components";

const Main = styled.main`
	height: 100%;
	display: flex;
	flex-direction: column;
	font-family: "Roboto", sans-serif;
`;

const UserInput = styled.div`
	flex-basis: 50px;
	padding: 12px;
`;

const ChatResponses = styled.ul`
	flex: 1 0;
	overflow-x: hidden;
	overflow-y: scroll;
	list-style-type: none;
	margin: 0;
	padding: 0;
`;

function ChatResponseList({ children }: PropsWithChildren) {
	const ref = useRef<HTMLDivElement>(null);

	useEffect(() => {
		ref.current?.scrollIntoView({ block: "nearest" });
	});

	return (
		<ChatResponses>
			{children}
			<div ref={ref}></div>
		</ChatResponses>
	);
}

let currentMessage = "";

function App() {
	const [loading, setLoading] = useState<boolean>(false);
	const [messages, setMessages] = useState<ChatMessage[]>([]);
	const [activeMessage, setActiveMessage] = useState<string>("");

	useEffect(() => {
		window.addEventListener("message", handleResponse);

		return () => {
			window.removeEventListener("message", handleResponse);
		};
	}, []);

	function handleResponse(event: MessageEvent<AppMessage>) {
		const { data } = event;
		const { command, value } = data;

		if (command === "done") {
			if (!currentMessage) {
				currentMessage =
					"Sorry, I am having trouble generating a response.";
			}

			setMessages((messages) => [
				...messages,
				{
					from: "bot",
					message: currentMessage,
				},
			]);

			setLoading(false);
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

			setMessages((messages) => [
				...messages,
				{
					from: "user",
					message: text,
				},
			]);

			setLoading(true);

			element.value = "";
		}
	}

	return (
		<Main>
			<h2>Code Assistant</h2>
			<ChatResponseList>
				{messages.map(({ from, message }, index) => (
					<ChatEntry key={index} from={from} message={message} />
				))}
				{loading && (
					<ChatEntry
						from="bot"
						message={activeMessage}
						loading={loading}
					/>
				)}
			</ChatResponseList>
			<UserInput>
				<VSCodeTextField
					placeholder="Type here to chat with the extension"
					disabled={activeMessage !== ""}
					style={{ width: "100%" }}
					onKeyDown={handleUserInput}
				/>
			</UserInput>
		</Main>
	);
}

export default App;
