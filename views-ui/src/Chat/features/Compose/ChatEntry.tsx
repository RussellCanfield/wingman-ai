import { PropsWithChildren, memo, useMemo } from "react";
import { FaUser } from "react-icons/fa";
import Markdown from "react-markdown";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { FaTerminal } from "react-icons/fa";
import { AiOutlineLoading3Quarters } from "react-icons/ai";
import {
	prism,
	vscDarkPlus,
} from "react-syntax-highlighter/dist/esm/styles/prism";
import { FileMetadata } from "@shared/types/v2/Message";
import { vscode } from "../../utilities/vscode";
import { ComposerMessage, DiffViewCommand } from "@shared/types/v2/Composer";
import { SkeletonLoader } from "../../SkeletonLoader";
import { useSettingsContext } from "../../context/settingsContext";
import { HiOutlineXMark } from "react-icons/hi2";
import { GrCheckmark } from "react-icons/gr";
import { PiGitDiff } from "react-icons/pi";
import { FaUndo } from "react-icons/fa";
import { Tooltip } from 'react-tooltip'

export function extractCodeBlock(text: string) {
	const regex = /```.*?\n([\s\S]*?)\n```/g;
	const matches = [];
	let match;
	while ((match = regex.exec(text)) !== null) {
		matches.push(match[1]);
	}
	return matches.length > 0 ? matches.join("\n") : text;
}

const mergeIntoFile = (file: FileMetadata) => {
	if (file) {
		vscode.postMessage({
			command: "accept-file",
			value: file,
		});
	}
};

const rejectFile = (file: FileMetadata) => {
	if (file) {
		vscode.postMessage({
			command: "reject-file",
			value: file,
		});
	}
}

const showDiffview = (file: FileMetadata) => {
	if (file) {
		vscode.postMessage({
			command: "diff-view",
			value: {
				file
			} satisfies DiffViewCommand,
		});
	}
};

const undoFile = (file: FileMetadata) => {
	if (file) {
		vscode.postMessage({
			command: "undo-file",
			value: file
		});
	}
}

const openFile = (file: FileMetadata) => {
	if (file) {
		vscode.postMessage({
			command: "open-file",
			value: {
				path: file.path,
			} satisfies FileMetadata,
		});
	}
}

const getTruncatedPath = (path: string) => {
	const parts = path.split('/');
	const fileName = parts.pop() ?? '';
	const lastFolder = parts.pop();

	const shortPath = lastFolder
		? `${lastFolder}/${fileName}`
		: fileName;

	return parts.length > 0
		? `.../${shortPath}`
		: shortPath;
};

const CodeContainer = memo(
	({
		children,
		file,
		step,
	}: PropsWithChildren<{ file?: FileMetadata; step?: any }>) => {
		return (
			<div className="relative rounded-md bg-editor-bg">
				<div className="overflow-x-auto p-4 markdown-container">
					{children}
				</div>
			</div>
		);
	}
);

const renderMarkdown = (
	content: string,
	theme: any,
	file?: FileMetadata,
	step?: any
) => {
	return (
		<div className="prose prose-invert max-w-none">
			<Markdown
				children={content}
				components={{
					code(props) {
						const { children, className, ...rest } = props;
						const languageType = /language-(\w+)/.exec(
							className || ""
						);
						return languageType ? (
							//@ts-expect-error
							<SyntaxHighlighter
								{...rest}
								PreTag={CodeContainer}
								children={String(children).replace(/\n$/, "")}
								style={theme}
								language={languageType[1]}
								wrapLines={true}
								wrapLongLines={true}
								file={file}
								step={step}
								className="!bg-editor-bg !p-0"
							/>
						) : (
							<code
								{...rest}
								className={`${className} whitespace-pre-wrap bg-editor-bg rounded px-2 py-1`}
							>
								{children}
							</code>
						);
					},
				}}
			/>
		</div>
	);
};

const ChatArtifact = ({
	file,
	loading,
}: {
	file: FileMetadata,
	loading: boolean
}) => {
	const diffParts = file.diff?.split(',');
	const truncatedPath = getTruncatedPath(file.path);

	return (
		<div className="border border-stone-700/50 rounded-lg overflow-hidden shadow-lg mb-4 mt-4 bg-stone-700">
			<div className="text-white flex flex-col border-b border-stone-700/50">
				<div className="flex items-center justify-start border-b border-stone-700/50 relative">
					<Tooltip id={`${file.path}-tooltip`} />
					<h4
						className="m-0 p-3 font-medium truncate cursor-pointer hover:underline transition-all text-sm group"
						data-tooltip-id={`${file.path}-tooltip`}
						data-tooltip-content={file.path}
						onClick={() => openFile(file)}
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

					{!file.code && loading && (
						<div className="flex justify-center mr-4">
							<AiOutlineLoading3Quarters
								className="animate-spin text-stone-400"
								size={24}
							/>
						</div>
					)}
					{!loading && file?.description && !file.accepted && !file.rejected && (
						<div className="flex flex-nowrap gap-1 ml-auto mr-4">
							{/* Reject Button */}
							<div className="flex items-center rounded z-10 transition-colors text-red-600 hover:bg-red-600/10 hover:shadow-lg focus:ring focus:ring-red-400">
								<button
									type="button"
									title="Reject changes"
									className="p-2"
									onClick={() => rejectFile(file)}
								>
									<HiOutlineXMark size={18} />
								</button>
							</div>
							{/* Show Diff Button */}
							<div className="flex items-center rounded z-10 transition-colors hover:bg-yellow-500/10 hover:shadow-lg focus:ring focus:ring-yellow-400" style={{ color: '#ffaf38' }}>
								<button
									type="button"
									title="Show diff"
									className="p-2"
									onClick={() => showDiffview(file)}
								>
									<PiGitDiff size={16} />
								</button>
							</div>
							{/* Accept Button */}
							<div className="flex items-center rounded z-10 transition-colors text-green-400 hover:bg-green-400/10 hover:shadow-lg focus:ring focus:ring-green-400">
								<button
									type="button"
									title="Accept changes"
									className="p-2"
									onClick={() => mergeIntoFile(file)}
								>
									<GrCheckmark size={16} />
								</button>
							</div>
						</div>
					)}
					{(file.rejected || file.accepted) && (
						<div className="flex items-center gap-3 ml-auto mr-4">
							{/* Undo Button */}
							<div className="flex items-center rounded z-10 transition-colors text-stone-400 hover:bg-stone-700/10 hover:shadow-lg focus:ring focus:ring-stone-400">
								<button
									type="button"
									title="Undo changes"
									className="p-2"
									onClick={() => undoFile(file)}
								>
									<FaUndo size={14} />
								</button>
							</div>
							{file.rejected && (
								<span className="flex items-center gap-1 text-base text-red-400">
									<span>Rejected</span>
								</span>
							)}
							{file.accepted && (
								<span className="flex items-center gap-1 text-base text-green-400">
									<span>Accepted</span>
								</span>
							)}
						</div>
					)}
				</div>
			</div>
		</div>
	);
};

const ChatEntry = ({
	from,
	message,
	files,
	loading,
	image,
	isCurrent
}: PropsWithChildren<ComposerMessage & { isCurrent?: boolean }>) => {
	const { isLightTheme } = useSettingsContext();
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

	const bgClasses = fromUser ? `bg-stone-700 rounded-lg overflow-hidden w-full` : "";
	const textColor = fromUser ? "text-gray-200" : "text-[var(--vscode-input-foreground)]";

	const hasPendingFiles = files?.some(f => !f.accepted && !f.rejected);

	return (
		<li
			className="tracking-wide leading-relaxed text-md message mb-8"
		>
			<div className={`${fromUser ? "" : "pl-[48px]"} pr-[16px] flex items-center ${textColor}`}>
				<div className="relative flex items-center gap-4 flex-grow w-full">
					{fromUser && (
						<div className="flex-shrink-0 w-8 h-8 rounded-full bg-stone-700 flex items-center justify-center">
							<FaUser className="text-stone-200" size={16} />
						</div>
					)}
					<div className={`${bgClasses} flex-grow w-full justify-center items-center ${fromUser ? "shadow-lg" : ""}`}>
						<div className={`${from === 'user' ? 'p-3' : ''}`}>
							{message !== "" && renderMarkdown(message, codeTheme)}
						</div>
						{image && (
							<div className="p-3">
								<img
									src={image.data}
									alt="Image preview"
									className="max-w-full h-auto rounded-lg"
									style={{ maxHeight: "512px" }}
								/>
							</div>
						)}
						{files && files?.length > 0 && (
							<div>
								<h3 className="text-lg font-semibold mb-4">Files:</h3>
								{files?.map((file, index) => (
									<div key={index}>
										{file.description && (
											<p className="mb-2">{file.description}</p>
										)}
										<ChatArtifact
											file={file}
											loading={loading || !isCurrent || false}
										/>
									</div>
								))}
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
			{isCurrent && !loading && files && files?.length > 1 && (
				<div className="border-t border-stone-700/50 mt-4 pt-4 pl-[48px] pr-[16px] text-[var(--vscode-input-foreground)]">
					<p>
						Summary:
					</p>
					<div className="flex flex-col items-center text-sm overflow-y-auto max-h-48">
						{files.map(f => {
							const truncatedPath = getTruncatedPath(f.path);
							const diffParts = f.diff?.split(',') ?? [0, 0];

							return (
								<div key={f.path} className="flex items-center justify-between gap-4 w-full min-h-[3rem] py-1 hover:bg-stone-800/50">
									<div className="flex flex-1 min-w-0">
										<h4 className="m-0 p-3 font-medium truncate flex-1 cursor-pointer" onClick={() => showDiffview(f)}>
											{truncatedPath}
										</h4>
										<div className="flex items-center gap-2 px-3 text-sm whitespace-nowrap">
											<span className="flex items-center gap-1 text-green-400">
												<span>{diffParts[0]}</span>
											</span>
											<span className="flex items-center gap-1 text-red-400">
												<span>{diffParts[1]}</span>
											</span>
										</div>
									</div>
									{(f.rejected || f.accepted) && (
										<div className="flex items-center gap-3 shrink-0">
											<div className="flex items-center rounded z-10 hover:bg-stone-700 transition-colors">
												<button
													type="button"
													title="Undo changes"
													className="p-2"
													onClick={() => undoFile(f)}
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
											<div className="flex items-center rounded z-10 hover:bg-stone-700 transition-colors text-red-600">
												<button
													type="button"
													title="Reject changes"
													className="p-3"
													onClick={() => rejectFile(f)}
												>
													<HiOutlineXMark size={18} />
												</button>
											</div>
											<div className="flex items-center rounded z-10 hover:bg-stone-700 transition-colors text-green-400">
												<button
													type="button"
													title="Accept changes"
													className="p-3"
													onClick={() => mergeIntoFile(f)}
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
								onClick={() => files.forEach(f => rejectFile(f))}
								className="px-3 py-2 text-sm rounded-md bg-red-600 hover:bg-red-700 transition-colors"
							>
								Reject All
							</button>
							<button
								onClick={() => files.forEach(f => mergeIntoFile(f))}
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