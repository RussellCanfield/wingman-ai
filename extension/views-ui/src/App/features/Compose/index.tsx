import type {
	ComposerRequest,
} from "@shared/types/Composer";
import { ChatInput } from "./Input/ChatInput";
import { ErrorBoundary } from 'react-error-boundary';
import ChatThreadList from "./ChatThreadList";
import { useComposerContext } from "../../context/composerContext";
import ThreadManagement from "./ThreadManagement";
import { useSettingsContext } from "../../context/settingsContext";
import { VscArrowDown, VscArrowUp } from "react-icons/vsc";
import { AiOutlineLoading3Quarters } from "react-icons/ai";
import { FaRegQuestionCircle } from "react-icons/fa";
import { Tooltip } from "react-tooltip";

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

	const displayTokens = inputTokens > 0 && outputTokens > 0;
	const showWelcomeScreen = !initialized || !activeComposerState?.messages.length;

	if (showWelcomeScreen) {
		return (
			<main className="flex-1 min-h-0 flex flex-col text-base">
				<div className="flex-1 flex items-center justify-center h-full p-4 min-h-0">
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
						{!initialized && (
							<div className="relative py-4">
								<div className="absolute inset-0 bg-gradient-to-r from-blue-400/10 to-purple-500/10 rounded-xl blur-xl" />
								<div className="relative flex items-center justify-center space-x-3 p-3">
									<div className="h-8 w-8 flex items-center justify-center">
										<AiOutlineLoading3Quarters
											size={24}
											className="text-blue-400 animate-spin"
										/>
									</div>
									<p className="text-sm font-medium bg-gradient-to-r from-blue-400 to-blue-600 bg-clip-text text-transparent">
										Preparing your AI assistant
									</p>
								</div>
							</div>
						)}
						{initialized && (
							<>
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
							</>)}
					</div>
				</div>
				<div className="flex-shrink-0 mb-2">
					<ChatInput
						loading={loading}
						threadId={activeThread?.id}
						onChatSubmitted={handleChatSubmitted}
						onChatCancelled={cancelAIResponse}
						suggestionItems={fileDiagnostics}
					/>
				</div>
			</main>)
	}

	return (
		<>
			<div className="flex-shrink-0 flex items-center justify-between p-2 pt-0 border-b border-[var(--vscode-panel-border)]">
				<ThreadManagement loading={loading} />
				<div>
					<Tooltip
						id="question-tooltip"
						content="If you switch AI providers or abruptly stop mid-chat. It can cause compatibility issues, simply clear the chat to continue."
						place="right"
						className="max-w-xs z-50"
						style={{
							backgroundColor: isLightTheme ? '#333' : '#f5f5f5',
							color: isLightTheme ? '#fff' : '#333',
							borderRadius: '6px',
							padding: '8px 12px',
							boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)'
						}}
					/>
					<FaRegQuestionCircle size={16} data-tooltip-id="question-tooltip" />
				</div>
			</div>
			<main className="flex-1 min-h-0 flex flex-col text-base">
				<ErrorBoundary resetKeys={[activeComposerState ?? 0]} fallback={
					<div className="flex items-center justify-center h-full p-4 bg-[var(--vscode-input-background)] rounded-md">
						<div className="text-center max-w-lg p-6">
							<h2 className="text-xl font-semibold mb-3">Oops, something went wrong!</h2>
							<p className="mb-4">
								We couldn't load your messages. Please try clearing your chat history.
							</p>
						</div>
					</div>}>
					< ChatThreadList loading={loading} key={activeThread?.id} />
					<div className="flex-shrink-0 mb-2">
						{displayTokens && (
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
					</div>
				</ErrorBoundary>
			</main>
		</>
	);
}
