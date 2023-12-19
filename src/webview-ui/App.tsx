import { vscode } from "./utilities/vscode";
import { VSCodeTextField } from "@vscode/webview-ui-toolkit/react";
import { PropsWithChildren, useEffect, useRef, useState } from "react";
import { AppMessage, ChatMessage } from "./types/Message";
import ChatEntry from "./ChatEntry";
import styled, { keyframes } from "styled-components";

const Main = styled.main`
	height: 100%;
	display: flex;
	flex-direction: column;
`;

const UserInput = styled.div`
	flex-basis: 60px;
`;

const ChatResponses = styled.div`
	flex: 1 0;
	overflow: scroll;
`;

const LoaderAnimation = keyframes`
  0% {
    transform: rotate(0deg);
  }
  100% {
    transform: rotate(360deg);
  }
`;

const Loader = styled.span`
	width: 48px;
	height: 48px;
	border: 2px solid #fff;
	border-radius: 50%;
	display: inline-block;
	position: relative;
	box-sizing: border-box;
	animation: ${LoaderAnimation} 1s linear infinite;
	&:after,
	&:before {
		content: "";
		box-sizing: border-box;
		position: absolute;
		left: 0;
		top: 0;
		background: #ff3d00;
		width: 6px;
		height: 6px;
		border-radius: 50%;
	}
	&:before {
		left: auto;
		top: auto;
		right: 0;
		bottom: 0;
	}
`;

function ChatResponseList({ children }: PropsWithChildren) {
	const ref = useRef<HTMLDivElement>(null);

	useEffect(() => {
		ref.current?.scrollIntoView({ block: "nearest" });
	});

	return <ChatResponses ref={ref}>{children}</ChatResponses>;
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

	function handleResponse(event: MessageEvent<AppMessage>) {
		const { data } = event;
		const { command, value } = data;

		if (command === "done") {
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

			setMessages((messages) => [
				...messages,
				{
					from: "user",
					message: text,
				},
			]);

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
				{activeMessage && (
					<ChatEntry
						from="bot"
						message={activeMessage}
						loader={<Loader />}
					/>
				)}
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
