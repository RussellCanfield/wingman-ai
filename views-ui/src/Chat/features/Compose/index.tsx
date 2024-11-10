import {
	ComposerRequest,
} from "@shared/types/Composer";
import { useMemo } from "react";
import { vscode } from "../../utilities/vscode";
import ChatEntry from "./ChatEntry";
import { ChatInput } from "./Input/ChatInput";
import ChatResponseList from "./ChatList";
import Validation from "./Validation";
import { phaseDisplayLabel, useComposerContext } from "../../context/composerContext";

let currentMessage = "";

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
	const { composerMessages, setComposerMessages, loading, setLoading, currentPhase, setCurrentPhase, clearActiveMessage, activeMessage } = useComposerContext();

	const cancelAIResponse = () => {
		clearActiveMessage();
		vscode.postMessage({
			command: "cancel",
		});
		setLoading(false);
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
					The composer feature allows you to generate code changes
					across files. You can ask for help with code, or ask for
					code to be written for you. By default, composer will
					intelligently choose files in your project based on your
					input. You can also target specific files using '@filename'.
					<br />
					<br />
					Composer is also multi-modal, copy and paste an image or
					attach one. Lets go! 🚀
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
