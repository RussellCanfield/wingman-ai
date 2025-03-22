import type {
	ComposerRequest,
} from "@shared/types/Composer";
import { ChatInput } from "./Input/ChatInput";
import { ErrorBoundary } from 'react-error-boundary';
import ChatThreadList from "./ChatThreadList";
import { useComposerContext } from "../../context/composerContext";
import ThreadManagement from "./ThreadManagement";
import { SkeletonLoader } from "../../SkeletonLoader";
import { useSettingsContext } from "../../context/settingsContext";
import { VscArrowDown, VscArrowUp } from "react-icons/vsc";

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
		createThread,
		loading,
		inputTokens,
		outputTokens,
		sendComposerRequest,
		clearActiveMessage,
		activeComposerState,
		activeThread,
		fileDiagnostics,
		initialized
	} = useComposerContext();
	const { isLightTheme } = useSettingsContext();

	const cancelAIResponse = () => {
		clearActiveMessage();
	};

	const handleChatSubmitted = async (
		input: string,
		contextFiles: string[],
		image?: File
	) => {
		const thread = activeThread ?? createThread(input, true);

		const payload: ComposerRequest = {
			input,
			threadId: thread.id,
			contextFiles,
		};

		if (image) {
			payload.image = {
				data: await getBase64FromFile(image),
				ext: getFileExtension(image.name),
			};
		}

		sendComposerRequest(payload, thread);
	};

	const cssClasses = `${isLightTheme
		? "bg-white shadow-[0_2px_4px_rgba(0,0,0,0.1),0_8px_16px_rgba(0,0,0,0.1)] hover:shadow-[0_4px_8px_rgba(0,0,0,0.15),0_12px_24px_rgba(0,0,0,0.15)]"
		: "bg-[#1e1e1e] shadow-[0_2px_4px_rgba(0,0,0,0.2),0_8px_16px_rgba(0,0,0,0.2)] hover:shadow-[0_4px_8px_rgba(0,0,0,0.25),0_12px_24px_rgba(0,0,0,0.25)]"
		}`;

	return (
		<main className="h-full flex flex-col overflow-auto text-base justify-between">
			<div className="flex items-center justify-between p-2 pt-0 border-b border-[var(--vscode-panel-border)]">
				<ThreadManagement loading={loading} />
			</div>
			<ErrorBoundary resetKeys={[activeComposerState ?? 0]} fallback={<div className="flex items-center justify-center h-full p-4 bg-[var(--vscode-input-background)] rounded-md">
				<div className="text-center max-w-lg p-6">
					<h2 className="text-xl font-semibold mb-3">Oops, something went wrong!</h2>
					<p className="mb-4">
						We couldn't load your messages. Please try restarting the editor or clearing your chat history.
					</p>
				</div>
			</div>}>
				{!activeComposerState?.messages.length && (
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
				{!initialized && (
					<div className="mb-8 flex justify-center items-center">
						<SkeletonLoader isDarkTheme={true} />
					</div>
				)}
				{initialized && (
					<>
						<ChatThreadList loading={loading} />
						{inputTokens > 0 && outputTokens > 0 && (
							<div className="mt-4 flex justify-center items-center gap-3 text-gray-400/70 text-sm">
								<div className={`flex items-center gap-2 px-3 py-1.5 rounded-full ${cssClasses}`}>
									<span className="font-medium text-xs uppercase tracking-wider">Usage</span>
									<span className="flex items-center text-blue-400/90">
										<VscArrowUp className="mr-1" size={12} /> {inputTokens.toLocaleString()}
									</span>
									<span className="flex items-center text-green-400/90">
										<VscArrowDown className="mr-1" size={12} /> {outputTokens.toLocaleString()}
									</span>
									<span className="text-gray-300/80 font-medium">
										Total: {(inputTokens + outputTokens).toLocaleString()}
									</span>
								</div>
							</div>
						)}
						<ChatInput
							loading={loading}
							threadId={activeThread?.id}
							onChatSubmitted={handleChatSubmitted}
							onChatCancelled={cancelAIResponse}
							suggestionItems={fileDiagnostics}
						/>
					</>)}
			</ErrorBoundary>
		</main>
	);
}