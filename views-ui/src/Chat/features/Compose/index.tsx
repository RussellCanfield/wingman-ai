import { AppMessage, ChatMessage, CodeContext } from "@shared/types/Message";
import { ComposerMessage, ComposerResponse } from "@shared/types/Composer";
import { useEffect, useState } from "react";
import { vscode } from "../../utilities/vscode";
import ChatEntry from "./ChatEntry";
import { ChatInput } from "./ChatInput";
import { useAppContext } from "../../context";
import ChatResponseList from "./ChatList";

let currentMessage = "";
let currentContext: CodeContext | undefined;

type PhaseLabel = {
	[key: string]: string;
};
const phaseDisplayLabel: PhaseLabel = {
	new: "Planning",
	planner: "Writing Code",
	"code-writer": "Reviewing",
	replan: "Preparing Results",
};

export default function Compose() {
	const { composerMessages, setComposerMessages } = useAppContext();
	const [loading, setLoading] = useState<boolean>(false);
	const [currentPhase, setCurrentPhase] = useState<string>("new");

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
			case "compose-response":
				if (!value) {
					return;
				}

				const { node, values } = value as ComposerResponse;

				setCurrentPhase(node);

				if (node === "replan") {
					if (values.review?.comments.length > 0) {
						setComposerMessages((currentMessages) => {
							return [
								...currentMessages,
								{
									from: "assistant",
									message: `There were issues with the code changes, we are correcting them! Here was my review:
                  
${values.review.comments.join("\n")}`,
									plan: {
										files: [],
										steps: [],
									},
								},
							];
						});

						return;
					}

					if (
						values.plan?.files?.length === 0 &&
						values.plan?.steps?.length === 0
					) {
						setComposerMessages((currentMessages) => {
							return [
								...currentMessages,
								{
									from: "assistant",
									message:
										"Sorry something went wrong and I was not able to generate any changes.",
									plan: {
										files: [],
										steps: [],
									},
								},
							];
						});
						return;
					}

					setLoading(false);

					setComposerMessages((currentMessages) => {
						return [
							...currentMessages,
							{
								from: "assistant",
								message: values.response!,
								plan: values.plan!,
							},
						];
					});
				}
				break;
		}
	};

	const commitMessageToHistory = () => {
		const tempMessage = structuredClone(currentMessage.toString());
		const tempContext = structuredClone(currentContext);
		setComposerMessages((messages) => {
			const newHistory: ComposerMessage[] = [
				...messages,
				{
					from: "assistant",
					message: tempMessage,
					loading: false,
					plan: {
						files: [],
						steps: [],
					},
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

		currentMessage = "";
		currentContext = undefined;
	};

	const handleChatSubmitted = (input: string, contextFiles: string[]) => {
		currentMessage = "";

		vscode.postMessage({
			command: "compose",
			value: {
				input,
				contextFiles,
			},
		});

		setComposerMessages((messages) => [
			...messages,
			{
				from: "user",
				message: input,
				plan: {
					files: [],
					steps: [],
				},
			},
		]);

		setCurrentPhase("planner");
		setLoading(true);
	};

	return (
		<main className="h-full flex flex-col overflow-auto">
			<ChatResponseList messages={composerMessages}>
				{composerMessages.length !== 0 ? null : (
					<ChatEntry
						from="assistant"
						message={
							"Welcome! The composer feature allows you to generate code changes. You can ask for help with code, or ask for code to be written for you. By default, composer will intelligently choose files in your project based on your input. You can also target specific files using '@filename'. Lets go! 🚀"
						}
						loading={false}
						plan={{
							steps: [],
							files: [],
						}}
						index={0}
					/>
				)}
				{loading && (
					<ChatEntry
						from="assistant"
						message={phaseDisplayLabel[currentPhase] || "Planning"}
						loading={true}
						plan={{
							steps: [],
							files: [],
						}}
						index={1}
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
