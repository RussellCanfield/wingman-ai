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

export function extractCodeBlock(text: string) {
	const regex = /```.*?\n([\s\S]*?)\n```/g;
	const matches = [];
	let match;
	while ((match = regex.exec(text)) !== null) {
		matches.push(match[1]);
	}
	return matches.length > 0 ? matches.join("\n") : text;
}

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
	loading
}: {
	file: FileMetadata,
	loading: boolean
}) => {
	const mergeIntoFile = () => {
		if (file) {
			vscode.postMessage({
				command: "accept-file",
				value: file,
			});
		}
	};

	const rejectFile = () => {
		if (file) {
			vscode.postMessage({
				command: "reject-file",
				value: file,
			});
		}
	}

	const showDiffview = () => {
		if (file) {
			vscode.postMessage({
				command: "diff-view",
				value: {
					file: file.path,
					diff: file.code,
					language: file.language
				} as DiffViewCommand,
			});
		}
	};

	const openFile = () => {
		if (file) {
			vscode.postMessage({
				command: "open-file",
				value: {
					path: file.path,
				} as FileMetadata,
			});
		}
	}

	const truncatedPath = useMemo(() => {
		if (file.path.length <= 50) return file.path;
		return "..." + file.path.slice(-50);
	}, [file]);

	const diffParts = file.diff?.split(',');

	return (
		<div className="border border-stone-700/50 rounded-lg overflow-hidden shadow-lg mb-4 mt-4 bg-editor-bg/30">
			<div className="bg-stone-800/50 text-white flex items-center border-b border-stone-700/50 flex-wrap">
				<h4
					className="m-0 min-w-0 p-3 font-medium truncate flex-shrink cursor-pointer hover:underline transition-all text-base sm:text-sm md:text-xs"
					onClick={openFile}
				>
					{truncatedPath}
				</h4>
				{!file.code && loading && (
					<div className="p-4 flex justify-center">
						<AiOutlineLoading3Quarters
							className="animate-spin text-stone-400"
							size={24}
						/>
					</div>
				)}
				{diffParts && (
					<div className="flex items-center gap-2 px-3 text-sm flex-nowrap">
						<span className="flex items-center gap-1 text-green-400">
							<span>{diffParts[0]}</span>
						</span>
						<span className="flex items-center gap-1 text-red-400">
							<span>{diffParts[1]}</span>
						</span>
					</div>
				)}
				{!loading && file?.description && !file.accepted && !file.rejected && (
					<div className="flex flex-nowrap ml-auto">
						<div className="flex items-center rounded z-10 hover:bg-stone-700 transition-colors text-red-600">
							<button
								type="button"
								title="Reject changes"
								className="p-3"
								onClick={() => rejectFile()}
							>
								<HiOutlineXMark size={18} />
							</button>
						</div>
						<div className="flex items-center rounded z-10 hover:bg-stone-700 transition-colors" style={{ color: '#ffaf38' }}>
							<button
								type="button"
								title="Show diff"
								className="p-3"
								onClick={() => showDiffview()}
							>
								<PiGitDiff size={16} />
							</button>
						</div>
						<div className="flex items-center rounded z-10 hover:bg-stone-700 transition-colors text-green-400">
							<button
								type="button"
								title="Accept changes"
								className="p-3"
								onClick={() => mergeIntoFile()}
							>
								<GrCheckmark size={16} />
							</button>
						</div>
					</div>
				)}
				{(file.rejected || file.accepted) && (
					<div className="flex flex-nowrap ml-auto pr-4">
						{file.rejected && (<span className="flex items-center gap-1 text-red-400">
							<span>Rejected</span>
						</span>)}
						{file.accepted && (<span className="flex items-center gap-1 text-green-400">
							<span>Accepted</span>
						</span>)}
					</div>
				)}
			</div>
		</div>
	);
};

const ChatEntry = ({
	from,
	message,
	files,
	dependencies,
	greeting,
	loading,
	image,
	isCurrent
}: PropsWithChildren<ComposerMessage & { isCurrent?: boolean }>) => {
	const { isLightTheme } = useSettingsContext();
	const codeTheme = isLightTheme ? prism : vscDarkPlus;

	const mergeIntoFile = (file: FileMetadata) => {
		if (!file) return;

		vscode.postMessage({
			command: "accept-file",
			value: file,
		});
	};

	const rejectFile = (file: FileMetadata) => {
		if (!file) return;

		vscode.postMessage({
			command: "reject-file",
			value: file
		})
	}

	const showDiffview = (file: FileMetadata) => {
		if (file) {
			vscode.postMessage({
				command: "diff-view",
				value: {
					file: file.path,
					diff: file.code,
					language: file.language
				} as DiffViewCommand,
			});
		}
	};

	const sendTerminalCommand = (payload: string) => {
		if (payload) {
			vscode.postMessage({
				command: "terminal",
				value: payload,
			});
		}
	};

	const fromUser = from === "user";

	const bgClasses = fromUser ? `${!isLightTheme ? "bg-stone-600" : "bg-stone-600"
		} rounded-lg overflow-hidden w-full` : "";

	return (
		<li
			className="tracking-wide leading-relaxed text-md message mb-8"
		>
			<div className={`${fromUser ? "" : "pl-[48px]"} pr-[16px] flex items-center text-stone-300`}>
				<div className="relative flex items-center gap-4 flex-grow w-full">
					{fromUser && (
						<div className="flex-shrink-0 w-8 h-8 rounded-full bg-stone-700 flex items-center justify-center">
							<FaUser className="text-stone-300" size={16} />
						</div>
					)}
					<div className={`${bgClasses} flex-grow w-full justify-center items-center ${fromUser ? "shadow-lg" : ""}`}>
						{greeting &&
							renderMarkdown(greeting, codeTheme)
						}
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
								<h3 className="text-lg font-semibold text-stone-200 mb-4">Files:</h3>
								{files?.map((file, index) => (
									<div key={index}>
										{file.description && (
											<p className="mb-2">{file.description}</p>
										)}
										<ChatArtifact
											file={file}
											loading={loading ?? false}
										/>
									</div>
								))}
							</div>
						)}
						{dependencies && dependencies?.steps && dependencies?.steps?.length > 0 && (
							<div>
								<h3 className="text-lg font-semibold text-stone-200 mb-4 mt-0">Dependencies:</h3>
								<div className="space-y-3 mb-4">
									{dependencies.response && (<p>{dependencies.response}</p>)}
									{dependencies.steps.map((step, index) => (
										<div
											className="border border-stone-700/50 rounded-lg overflow-hidden bg-editor-bg/30"
											key={index}
										>
											<div className="bg-stone-800/50 text-white flex flex-row items-center border-b border-stone-700/50">
												<p className="flex-1 p-3 text-sm">
													{step.description}
												</p>
												{step.command && (
													<div className="flex space-x-2 text-white rounded hover:bg-stone-700 transition-colors z-10">
														<button
															type="button"
															title="Run in terminal"
															className="p-3"
															onClick={() =>
																sendTerminalCommand(
																	step.command!
																)
															}
														>
															<FaTerminal size={16} />
														</button>
													</div>
												)}
											</div>
											<div>
												{step.command &&
													renderMarkdown(
														`\`\`\`bash\n${step.command}\n\`\`\``,
														codeTheme,
														undefined,
														step
													)}
											</div>
										</div>
									))}
								</div>
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
			{isCurrent && !loading && files && (<div className="border-t border-stone-700/50 mt-4 pt-4">
				<div className="flex flex-col items-center justify-between text-sm text-stone-400 pl-[48px] pr-[16px]">
					{files.map(f => {
						const truncatedPath = useMemo(() => {
							if (f.path.length <= 50) return f.path;
							return "..." + f.path.slice(-50);
						}, [f]);

						const diffParts = f.diff?.split(',') ?? [0, 0];

						return (
							<div className="flex items-center justify-between gap-4 w-full max-h-24 overflow-y-scroll">
								<div className="flex">
									<h4 className="m-0 min-w-0 p-3 font-medium truncate flex-shrink cursor-pointer" onClick={() => showDiffview(f)}>
										{truncatedPath}
									</h4>
									<div className="flex items-center gap-2 px-3 text-sm flex-nowrap">
										<span className="flex items-center gap-1 text-green-400">
											<span>{diffParts[0]}</span>
										</span>
										<span className="flex items-center gap-1 text-red-400">
											<span>{diffParts[1]}</span>
										</span>
									</div>
								</div>
								<div className="flex gap-4 items-center">
									{!f.accepted && !f.rejected && (<HiOutlineXMark size={18} onClick={() => rejectFile(f)} />)}
									{f.rejected && (<span className=" text-red-400">
										<span><HiOutlineXMark size={18} /></span>
									</span>)}
									{f.accepted && (<span className=" text-green-400">
										<span><GrCheckmark size={16} /></span>
									</span>)}
									{!f.accepted && !f.rejected && (<GrCheckmark size={16} onClick={() => mergeIntoFile(f)} />)}
								</div>
							</div>
						)
					})}
					<div className="flex justify-end gap-4 w-full mt-4 border-t border-stone-700/50 pt-4">
						<button
							onClick={() => files.forEach(f => rejectFile(f))}
							className="px-3 py-2 text-sm rounded-md bg-red-600 hover:bg-red-700 text-white transition-colors"
						>
							Reject All
						</button>
						<button
							onClick={() => files.forEach(f => mergeIntoFile(f))}
							className="px-3 py-2 text-sm rounded-md bg-green-600 hover:bg-green-700 text-white transition-colors"
						>
							Accept All
						</button>
					</div>
				</div>
			</div>)}
		</li>
	);
};

export default ChatEntry;