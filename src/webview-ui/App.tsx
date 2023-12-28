import { vscode } from "./utilities/vscode";
import { VSCodeTextField } from "@vscode/webview-ui-toolkit/react";
import { PropsWithChildren, useEffect, useRef, useState } from "react";
import { AppMessage, ChatMessage } from "../types/Message";
import ChatEntry from "./ChatEntry";
import styled from "styled-components";
import { FaPlay, FaStopCircle } from "react-icons/fa";

const Main = styled.main`
	height: 100%;
	display: flex;
	flex-direction: column;
`;

const UserInput = styled.div`
	flex-basis: 50px;
	padding: 12px;
	display: flex;
	flex-direction: row;
	align-items: center;

	* :root {
		--input-background: red !important;
	}
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
	const chatInputBox = useRef<any>(null);
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
			commitMessageToHistory();
			return;
		}

		if (!value) {
			return;
		}

		currentMessage += value;
		setActiveMessage((message) => message + value);
	}

	function commitMessageToHistory() {
		setMessages((messages) => [
			...messages,
			{
				from: "Assistant",
				message: currentMessage,
			},
		]);

		setLoading(false);
		setActiveMessage("");
	}

	function cancelAIResponse() {
		vscode.postMessage({
			command: "cancel",
		});
		commitMessageToHistory();
	}

	function fetchAIResponse(text: string) {
		currentMessage = "";

		vscode.postMessage({
			command: "chat",
			value: text,
		});
	}

	function handleUserInput(e: React.KeyboardEvent<HTMLInputElement>) {
		if (e.key === "Enter") {
			const element = e.target as HTMLInputElement;
			const message = element.value;

			if (!message) {
				return;
			}

			e.preventDefault();

			fetchAIResponse(message);

			setMessages((messages) => [
				...messages,
				{
					from: "User",
					message: message,
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
						from="Assistant"
						message={activeMessage}
						loading={loading}
					/>
				)}
			</ChatResponseList>
			<UserInput>
				<VSCodeTextField
					placeholder="Type here to chat with the extension"
					ref={chatInputBox}
					style={
						{
							width: "100%",
							"--input-height": "36",
						} as React.CSSProperties
					}
					onKeyDown={handleUserInput}
				>
					{!loading && (
						<span slot="end">
							<FaPlay
								size={16}
								onClick={() =>
									handleUserInput({
										key: "Enter",
										preventDefault: () => {},
										target: chatInputBox.current,
									} as unknown as React.KeyboardEvent<HTMLInputElement>)
								}
							/>
						</span>
					)}
					{loading && (
						<span slot="end">
							<FaStopCircle
								size={16}
								onClick={cancelAIResponse}
							/>
						</span>
					)}
				</VSCodeTextField>
			</UserInput>
		</Main>
	);
}

export default App;
