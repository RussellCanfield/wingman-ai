import { useMemo, type PropsWithChildren } from "react";
import { FaUndo, FaUser } from "react-icons/fa";
import {
	prism,
	vscDarkPlus,
} from "react-syntax-highlighter/dist/esm/styles/prism";
import type { ComposerMessage } from "@shared/types/v2/Composer";
import { SkeletonLoader } from "../../SkeletonLoader";
import { useSettingsContext } from "../../context/settingsContext";
import { MessageWithMarkdown } from "./components/Markdown";
import { ChatArtifact } from "./components/File";
import { FileToolNames } from "./components/types";
import { ToolOutput } from "./components/ToolOutput";
import { vscode } from "../../utilities/vscode";
import { HiOutlineXMark } from "react-icons/hi2";
import { GrCheckmark } from "react-icons/gr";
import { useComposerContext } from "../../context/composerContext";
import { acceptFile, getTruncatedPath, openFile, rejectFile, undoFile } from "../../utilities/files";
import type { FileMetadata } from "@shared/types/v2/Message";

export function extractCodeBlock(text: string) {
	const regex = /```.*?\n([\s\S]*?)\n```/g;
	const matches = [];
	let match: RegExpExecArray | null;
	// biome-ignore lint/suspicious/noAssignInExpressions: <explanation>
	while ((match = regex.exec(text)) !== null) {
		matches.push(match[1]);
	}
	return matches.length > 0 ? matches.join("\n") : text;
}

const ChatEntry = ({
	from,
	message,
	events,
	loading,
	image,
	isCurrent
}: PropsWithChildren<ComposerMessage & { isCurrent?: boolean }>) => {
	const { isLightTheme } = useSettingsContext();
	const { activeThread } = useComposerContext();

	const codeTheme = isLightTheme ? prism : vscDarkPlus;

	const sendTerminalCommand = (payload: string) => {
		if (payload) {
			vscode.postMessage({
				command: "terminal",
				value: payload,
			});
		}
	};

	const fromUser = from === "user";

	const bgClasses = fromUser ? "bg-stone-800 rounded-lg overflow-hidden w-full" : "";
	const textColor = fromUser ? "text-gray-200" : "text-[var(--vscode-input-foreground)]";

	const files = useMemo(() => {
		return (events ?? [])
			.filter(e => e.type === "tool-end" && FileToolNames.includes(e.metadata?.tool!))
			.map(e => JSON.parse(e.content) satisfies FileMetadata)
			.filter(Boolean);
	}, [events]);

	const hasPendingFiles = files && files.length > 0 && files?.some(f => !f.accepted && !f.rejected);

	return (
		<li
			className="tracking-wide leading-relaxed text-md message mb-8"
		>
			<div className={`${fromUser ? "" : "pl-[48px]"} pr-[16px] flex items-center ${textColor}`}>
				<div className="relative flex items-center gap-4 flex-grow w-full">
					{fromUser && (
						<div className="flex-shrink-0 w-8 h-8 rounded-full bg-stone-800 flex items-center justify-center">
							<FaUser className="text-stone-200" size={16} />
						</div>
					)}
					<div className={`${bgClasses} flex-grow w-full justify-center items-center ${fromUser ? "shadow-lg" : ""}`}>
						{fromUser && (
							<MessageWithMarkdown message={message} from={from} codeTheme={codeTheme} key={message} />
						)}
						{events?.map((e, i) => {
							// Check if this tool-start has a matching tool-end
							const hasEndEvent = e.type === "tool-start" &&
								events.some(endEvent =>
									endEvent.type === "tool-end" &&
									endEvent.metadata?.tool === e.metadata?.tool &&
									endEvent.id === e.id
								);

							// For tool-start events that have a matching end event, skip rendering
							// as we'll render the tool-end event instead
							if (e.type === "tool-start" && hasEndEvent) {
								return null;
							}

							if (e.type === "message") {
								return <MessageWithMarkdown from={from} message={e.content} codeTheme={codeTheme} />;
							}
							// Show tool-start events (that don't have an end event yet)
							if (e.type === "tool-start") {
								if (FileToolNames.includes(e.metadata?.tool!)) {
									const file = files?.find(f => f.path === e.metadata?.path);
									return <ChatArtifact loading={loading} isLightTheme={isLightTheme} file={file} key={e.id} />;
								}

								const toolHasNoEndEvent = i < events.length - 1 && !hasEndEvent;
								return <ToolOutput loading={!toolHasNoEndEvent} isLightTheme={isLightTheme} event={e} key={e.id} failed={toolHasNoEndEvent} />;
							}
							// Show tool-end events
							if (e.type === "tool-end") {
								if (FileToolNames.includes(e.metadata?.tool!)) {
									const file = files?.find(f => f.path === e.metadata?.path);
									return <ChatArtifact loading={loading} isLightTheme={isLightTheme} file={file} key={e.id} />;
								}
								return <ToolOutput loading={false} isLightTheme={isLightTheme} event={e} key={e.id} />;
							}

							return null;
						})}
						{image && (
							<div className="p-3">
								<img
									src={image.data}
									alt="Attached Preview"
									className="max-w-full h-auto rounded-lg"
									style={{ maxHeight: "512px" }}
								/>
							</div>
						)}
						{from === 'assistant' && loading && (
							<div className="mt-4 flex justify-center items-center">
								<SkeletonLoader isDarkTheme={!isLightTheme} />
							</div>
						)}
					</div>
				</div>
			</div>
			{isCurrent && !loading && files && files.length > 0 && (
				<div className="border-t border-stone-700/50 mt-4 pt-4 pl-[48px] pr-[16px] text-[var(--vscode-input-foreground)]">
					<p className="mb-2">
						Summary:
					</p>
					<div className="flex flex-col items-center text-sm overflow-y-auto max-h-48">
						{files.map(f => {
							const truncatedPath = getTruncatedPath(f.path);
							const diffParts = f.diff?.split(',') ?? [0, 0];

							return (
								<div key={f.path} className="flex items-center justify-between gap-4 w-full hover:bg-stone-800/50">
									<div className="flex flex-1 min-w-0">
										<h4
											className="m-0 p-3 font-medium truncate cursor-pointer hover:underline transition-all text-sm group"
											data-tooltip-id={`${f.path}-tooltip`}
											data-tooltip-content={f.path}
											onClick={() => openFile(f)}
											onKeyDown={(e) => {
												if (e.key === 'Enter' || e.key === ' ') {
													e.preventDefault();
													openFile(f);
												}
											}}
											style={{ flex: '0 1 auto', minWidth: '0' }}
										>
											{truncatedPath}
										</h4>
										{diffParts && (
											<div className="flex items-center justify-evenly text-sm gap-2 mr-4">
												<span className="flex items-center text-green-400">
													<span>{diffParts[0]}</span>
												</span>
												<span className="flex items-center text-red-400">
													<span>{diffParts[1]}</span>
												</span>
											</div>
										)}
									</div>
									{(f.rejected || f.accepted) && (
										<div className="flex items-center gap-3 shrink-0 p-3">
											<div className="flex items-center rounded z-10 hover:bg-stone-800 transition-colors">
												<button
													type="button"
													title="Undo changes"
													className="p-2"
													onClick={() => undoFile(f, activeThread?.id!)}
												>
													<FaUndo size={14} />
												</button>
											</div>
											{f.rejected && (
												<span className="flex items-center gap-1 text-base text-red-400">
													<span>Rejected</span>
												</span>
											)}
											{f.accepted && (
												<span className="flex items-center gap-1 text-base text-green-400">
													<span>Accepted</span>
												</span>
											)}
										</div>
									)}
									{!f.rejected && !f.accepted && (
										<div className="flex shrink-0">
											<div className="flex items-center rounded z-10 hover:bg-stone-800 transition-colors text-red-600">
												<button
													type="button"
													title="Reject changes"
													className="p-3"
													onClick={() => rejectFile(f, activeThread?.id!)}
												>
													<HiOutlineXMark size={18} />
												</button>
											</div>
											<div className="flex items-center rounded z-10 hover:bg-stone-800 transition-colors text-green-400">
												<button
													type="button"
													title="Accept changes"
													className="p-3"
													onClick={() => acceptFile(f, activeThread?.id!)}
												>
													<GrCheckmark size={16} />
												</button>
											</div>
										</div>
									)}
								</div>
							)
						})}
					</div>
					{hasPendingFiles && (
						<div className="flex justify-end gap-4 w-full mt-4 border-t border-stone-700/50 pt-4 text-white">
							<button
								type="button"
								// biome-ignore lint/complexity/noForEach: <explanation>
								onClick={() => files.forEach(f => rejectFile(f, activeThread?.id!))}
								className="px-3 py-2 text-sm rounded-md bg-red-600 hover:bg-red-700 transition-colors"
							>
								Reject All
							</button>
							<button
								type="button"
								// biome-ignore lint/complexity/noForEach: <explanation>
								onClick={() => files.forEach(f => acceptFile(f, activeThread?.id!))}
								className="px-3 py-2 text-sm rounded-md bg-green-600 hover:bg-green-700 transition-colors"
							>
								Accept All
							</button>
						</div>
					)}
				</div>)}
		</li>
	);
};

export default ChatEntry;