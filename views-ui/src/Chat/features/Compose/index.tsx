import {
	ComposerRequest,
} from "@shared/types/v2/Composer";
import { useMemo } from "react";
import { vscode } from "../../utilities/vscode";
import ChatEntry from "./ChatEntry";
import { ChatInput } from "./Input/ChatInput";
import ChatResponseList from "./ChatList";
import Validation from "./Validation";
import { useComposerContext } from "../../context/composerContext";
import { useSettingsContext } from "../../context/settingsContext";

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
	const { composerMessages, setComposerMessages, loading, setLoading, clearActiveMessage, activeMessage } = useComposerContext();
	const { indexStats, setView } = useSettingsContext();

	const cancelAIResponse = () => {
		clearActiveMessage();
		vscode.postMessage({
			command: "cancel",
		});
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
				loading: false,
				plan: {
					files: [],
					steps: [],
				},
				image: payload.image,
			},
		]);

		setLoading(true);
	};

	return (
		<main className="h-full flex flex-col overflow-auto text-base justify-between">
			{composerMessages.length === 0 && (
				<div className="flex items-center justify-center h-full p-4">
					<div className="text-center max-w-2xl p-8 bg-[var(--vscode-input-background)] rounded-2xl border border-slate-700/30 shadow-2xl backdrop-blur-md mx-auto transition-all duration-300 hover:border-slate-700/50">
						<div
							id="wingman-logo"
							role="img"
							aria-label="Wingman Logo"
							className="h-16 w-16 sm:h-24 sm:w-24 bg-no-repeat bg-contain bg-center mb-8 mx-auto animate-fade-in"
						/>
						<h1 className="text-2xl font-semibold mb-6 bg-gradient-to-r from-blue-500 via-gray-300 to-blue-900 bg-clip-text text-transparent animate-gradient">
							Welcome to Wingman-AI
						</h1>
						<span className="text-[var(--vscode-input-foreground)] leading-relaxed">
							The composer feature allows you to generate code changes across files. You can ask for help with code, or ask for code to be written for you. By default, composer will intelligently choose files in your project based on your input. You can also target specific files using <kbd className="px-2 py-0.5 rounded bg-slate-700/30">@filename</kbd>.
							<br />
							<br />
							Composer is also multi-modal. Copy and paste an image or attach one. Let's go!
							<span className="inline-block animate-bounce ml-4">🚀</span>
						</span>
						{(!indexStats.exists || indexStats.files?.length === 0) && (
							<div className="mt-4 p-4 bg-[var(--vscode-inputValidation-warningBackground)] border border-[var(--vscode-inputValidation-warningBorder)] rounded-md text-[var(--vscode-inputValidation-warningForeground)]">
								<span className="flex items-center gap-2">
									⚠️ No context files found. Please ensure the indexer inclusion filter is correct or reference files directly.
								</span>
								<button
									className="bg-blue-500 text-white px-4 py-2 rounded disabled:opacity-50 mt-4"
									onClick={() => setView("index")}
								>
									Go to Indexer
								</button>
							</div>
						)}
					</div>
				</div>
			)}
			{composerMessages.length > 0 && (
				<ChatResponseList messages={composerMessages}>
					{loading && (
						<ChatEntry
							from="assistant"
							message={activeMessage?.message || ""}
							files={activeMessage?.files}
							loading={true}
							isCurrent={true}
						/>
					)}
				</ChatResponseList>
			)}
			<ChatInput
				loading={loading}
				onChatSubmitted={handleChatSubmitted}
				onChatCancelled={cancelAIResponse}
			/>
		</main>
	);
}
