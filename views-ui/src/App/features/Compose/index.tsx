import {
	ComposerMessage,
	ComposerRequest,
} from "@shared/types/v2/Composer";
import { vscode } from "../../utilities/vscode";
import ChatEntry from "./ChatEntry";
import { ChatInput } from "./Input/ChatInput";
import ChatResponseList from "./ChatList";
import { useComposerContext } from "../../context/composerContext";
import ThreadManagement from "./ThreadManagement";
import { AddMessageToThread } from "@shared/types/Settings";

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
	const {
		composerMessages,
		setComposerMessages,
		loading,
		setLoading,
		clearActiveMessage,
		activeMessage,
	} = useComposerContext();

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

		const composerMessage: ComposerMessage = {
			from: "user",
			message: input,
			loading: false,
			image: payload.image,
		};

		vscode.postMessage({
			command: "compose",
			value: payload,
		});

		vscode.postMessage({
			command: "add-message-to-thread",
			value: { threadId: crypto.randomUUID(), message: composerMessage } satisfies AddMessageToThread
		});

		setComposerMessages((messages) => [
			...messages,
			composerMessage
		]);

		setLoading(true);
	};

	return (
		<main className="h-full flex flex-col overflow-auto text-base justify-between">
			<div className="flex items-center justify-between p-2 pt-0 border-b border-[var(--vscode-panel-border)]">
				<ThreadManagement />
			</div>
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
							Start exploring your codebase, ask questions about your project, or get AI-assisted coding help.
							<br />
							<br />
							Wingman has your back!
						</span>
						<div className="inline-block mt-6 px-4 py-2 rounded-lg bg-slate-700/20 border border-slate-700/40">
							<section className="flex flex-col items-center gap-2 text-sm">
								<span className="text-blue-400">Pro tip:</span>
								<div>
									Type <kbd className="px-2 py-0.5 rounded bg-slate-700/30">@</kbd> to reference a file directly, or highlight text in your editor
								</div>
							</section>
						</div>
					</div>
				</div>
			)}
			{composerMessages.length > 0 && (
				<ChatResponseList messages={composerMessages}>
					{loading && (
						<ChatEntry
							from="assistant"
							message={activeMessage?.message || ""}
							events={activeMessage?.events}
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