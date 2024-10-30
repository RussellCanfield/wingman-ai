import { AppMessage } from "@shared/types/Message";
import {
	ComposerMessage,
	ComposerRequest,
	ComposerResponse,
} from "@shared/types/Composer";
import { useEffect, useMemo, useState } from "react";
import { vscode } from "../../utilities/vscode";
import ChatEntry from "./ChatEntry";
import { ChatInput } from "./Input/ChatInput";
import { useAppContext } from "../../context";
import ChatResponseList from "./ChatList";
import Validation from "./Validation";

let currentMessage = "";

type PhaseLabel = {
	new: "Planning";
	planner: "Writing Code";
	"code-writer": "Reviewing";
	replan: "Preparing Results";
};

const phaseDisplayLabel: PhaseLabel = {
	new: "Planning",
	planner: "Writing Code",
	"code-writer": "Reviewing",
	replan: "Preparing Results",
};

const getFileExtension = (fileName: string): string => {
	return fileName.slice(((fileName.lastIndexOf(".") - 1) >>> 0) + 2);
};

const getBase64FromFile = (file: File): Promise<string> => {
	return new Promise((resolve, reject) => {
		const reader = new FileReader();
		reader.readAsDataURL(file);
		reader.onload = () => resolve(reader.result as string);
		reader.onerror = (error) => reject(error);
	});
};

export default function Compose() {
	const { composerMessages, setComposerMessages } = useAppContext();
	const [loading, setLoading] = useState<boolean>(false);
	const [currentPhase, setCurrentPhase] =
		useState<keyof typeof phaseDisplayLabel>("new");

	useEffect(() => {
		window.addEventListener("message", handleResponse);

		return () => {
			window.removeEventListener("message", handleResponse);
		};
	}, []);

	useEffect(() => {
		if (composerMessages.length === 0) {
			setCurrentPhase("new");
			setLoading(false);
		}
	}, [composerMessages]);

	const handleResponse = (event: MessageEvent<AppMessage>) => {
		const { data } = event;
		const { command, value } = data;

		switch (command) {
			case "validation-failed":
				handleChatSubmitted(String(value), []);
				break;
			case "compose-response":
				if (!value) {
					return;
				}

				const { node, values } = value as ComposerResponse;

				setCurrentPhase(node as keyof typeof phaseDisplayLabel);

				if (node === "replan") {
					if (
						values.review &&
						values.review?.comments &&
						values.review.comments.length > 0
					) {
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

					if (
						values.review?.comments?.length > 0 &&
						values.retryCount === 0
					) {
						setComposerMessages((currentMessages) => {
							return [
								...currentMessages,
								{
									from: "assistant",
									message:
										"Sorry the review failed and I was unable to correct the changes. Please try again with a more specific query.",
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
	};

	const handleChatSubmitted = async (
		input: string,
		contextFiles: string[],
		image?: File
	) => {
		currentMessage = "";

		const payload: ComposerRequest = {
			input,
			contextFiles,
		};

		if (image) {
			payload.image = {
				data: await getBase64FromFile(image),
				ext: getFileExtension(image.name),
			};
		}

		vscode.postMessage({
			command: "compose",
			value: payload,
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
				image: payload.image,
			},
		]);

		setCurrentPhase("new");
		setLoading(true);
	};

	const canValidate = useMemo(() => {
		if (composerMessages.length === 0) return false;

		return (
			composerMessages[composerMessages.length - 1].plan?.files?.length >
				0 || false
		);
	}, [composerMessages]);

	return (
		<main className="h-full flex flex-col overflow-auto text-base">
			{composerMessages.length === 0 && (
				<p>
					The composer feature allows you to generate code changes.
					You can ask for help with code, or ask for code to be
					written for you. By default, composer will intelligently
					choose files in your project based on your input. You can
					also target specific files using '@filename'. Lets go! 🚀
				</p>
			)}
			<ChatResponseList messages={composerMessages}>
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
				{canValidate && <Validation />}
			</ChatResponseList>
			<ChatInput
				loading={loading}
				onChatSubmitted={handleChatSubmitted}
				onChatCancelled={cancelAIResponse}
			/>
		</main>
	);
}
