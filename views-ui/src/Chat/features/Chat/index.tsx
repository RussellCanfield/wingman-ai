import {
	AppMessage,
	Message,
	CodeContext,
	CodeReviewMessage,
} from "@shared/types/Message";
import { useEffect, useState } from "react";
import { vscode } from "../../utilities/vscode";
import { ChatResponseList } from "./ChatList";
import ChatEntry from "./ChatEntry";
import { ChatInput } from "./ChatInput";
import { useAppContext } from "../../context";

let currentMessage = "";
let currentContext: CodeContext | undefined;

export default function Chat() {
	const { messages, pushMessage } = useAppContext();
	const [loading, setLoading] = useState<boolean>(false);
	const [activeMessage, setActiveMessage] = useState<Message | undefined>();

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
						type: "chat",
					} satisfies Message;
				});
				break;
			case "done":
				commitMessageToHistory();
				break;
			case "code-review-failed":
				currentContext = undefined;
				currentMessage =
					"Sorry I have failed to generate a code review, please ensure Git is available locally";
				commitMessageToHistory();
				break;
			case "code-review-result":
				pushMessage({
					...(value as CodeReviewMessage),
				});
				clearMessage();
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
						type: "chat",
					} satisfies Message;
				});
				break;
		}
	};

	const commitMessageToHistory = () => {
		const tempMessage = structuredClone(currentMessage.toString());
		const tempContext = structuredClone(currentContext);
		pushMessage({
			from: "assistant",
			message: tempMessage,
			loading: false,
			context: tempContext,
			type: "chat",
		} satisfies Message);

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
		setActiveMessage(() => ({
			from: "assistant",
			context: undefined,
			message: "",
			loading: false,
			type: "chat",
		}));

		currentMessage = "";
		currentContext = undefined;
	};

	const handleChatSubmitted = (input: string, command?: string) => {
		currentMessage = "";

		vscode.postMessage({
			command: command || "chat",
			value: input,
		});

		pushMessage({
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
