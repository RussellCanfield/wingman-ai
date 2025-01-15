import { PropsWithChildren, memo } from "react";
import { FaCopy } from "react-icons/fa6";
import { FaUser } from "react-icons/fa";
import Markdown from "react-markdown";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { FaTerminal } from "react-icons/fa";
import {
	prism,
	vscDarkPlus,
} from "react-syntax-highlighter/dist/esm/styles/prism";
import { FileMetadata } from "@shared/types/Message";
import { vscode } from "../../utilities/vscode";
import { ComposerMessage, DiffViewCommand } from "@shared/types/v2/Composer";
import { MdOutlineDifference } from "react-icons/md";
import { LuFileCheck } from "react-icons/lu";
import { SkeletonLoader } from "../../SkeletonLoader";
import { useSettingsContext } from "../../context/settingsContext";

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
}: {
	file: FileMetadata;
}) => {
	const mergeIntoFile = () => {
		if (file) {
			vscode.postMessage({
				command: "mergeIntoFile",
				value: file,
			});
		}
	};

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

	const truncatePath = (path: string, maxLength: number = 50) => {
		if (path.length <= maxLength) return path;
		return "..." + path.slice(-maxLength);
	};

	const diffParts = file.diff?.split(',');

	return (
		<div className="border border-stone-700/50 rounded-lg overflow-hidden shadow-lg mb-4 mt-4 bg-editor-bg/30">
			<div className="bg-stone-800/50 text-white flex flex-wrap items-center border-b border-stone-700/50">
				<h4 className="m-0 flex-grow p-3 text-wrap break-all font-medium">
					{truncatePath(file.path)}
				</h4>
				{diffParts && (
					<div className="flex items-center gap-2 px-3 text-sm">
						<span className="flex items-center gap-1 text-green-400">
							<span>{diffParts[0]}</span>
						</span>
						<span className="flex items-center gap-1 text-red-400">
							<span>{diffParts[1]}</span>
						</span>
					</div>
				)}
				{file?.description && (
					<div className="flex">
						<div className="flex items-center text-white rounded z-10 hover:bg-stone-700 transition-colors">
							<button
								type="button"
								title="Show diff"
								className="p-3"
								onClick={() => showDiffview()}
							>
								<MdOutlineDifference size={16} />
							</button>
						</div>
						<div className="flex items-center text-white rounded z-10 hover:bg-stone-700 transition-colors">
							<button
								type="button"
								title="Accept changes"
								className="p-3"
								onClick={() => mergeIntoFile()}
							>
								<LuFileCheck size={16} />
							</button>
						</div>
					</div>)}
			</div>
		</div>
	);
};

const ChatEntry = ({
	from,
	message,
	files,
	steps,
	greeting,
	loading,
	image,
}: PropsWithChildren<ComposerMessage>) => {
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

	const bgClasses = from === "user" ? `${!isLightTheme ? "bg-stone-600" : "bg-stone-600"
		} rounded-lg overflow-hidden w-full` : "";

	return (
		<li
			className="tracking-wide leading-relaxed text-base message mb-8"
		>
			<div className={`max-w-[800px] ${from === "user" ? "" : "pl-[48px]"} pr-[48px] flex items-center text-stone-300`}>
				<div className="relative flex items-center gap-4 flex-grow">
					{from === "user" && (
						<div>
							<div className="flex-shrink-0 w-8 h-8 rounded-full bg-stone-700 flex items-center justify-center">
								<FaUser className="text-stone-300" size={16} />
							</div>
						</div>
					)}
					<div className={`${bgClasses} flex-grow w-full justify-center items-center`}>
						{greeting && (
							<p >{greeting}</p>
						)}
						<div className={`${from === 'user' ? 'p-3' : ''}`}>
							{message !== "" && renderMarkdown(message, codeTheme)}
						</div>
						{image && (
							<img
								src={image.data}
								alt="Image preview"
								className="max-w-full h-auto rounded-lg mt-4 mb-4"
								style={{ maxHeight: "512px" }}
							/>
						)}
						{steps && steps.length > 0 && (
							<div className="mt-6">
								<h3 className="text-lg font-semibold text-stone-200 mb-4">Steps:</h3>
								<div className="space-y-3">
									{steps?.map((step, index) => (
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
						{files && files?.length > 0 && (
							<div>
								{files?.map((file, index) => (
									<div key={index}>
										{file.description && (
											<p className="mb-2">{file.description}</p>
										)}
										<ChatArtifact
											file={file}
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
		</li>
	);
};

export default ChatEntry;