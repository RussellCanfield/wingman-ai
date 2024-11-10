import { CSSProperties, PropsWithChildren, memo } from "react";
import { FaCopy } from "react-icons/fa6";
import Markdown from "react-markdown";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { FaTerminal } from "react-icons/fa";
import {
	prism,
	vscDarkPlus,
} from "react-syntax-highlighter/dist/esm/styles/prism";
import { FileMetadata } from "@shared/types/Message";
import { vscode } from "../../utilities/vscode";
import { ComposerMessage } from "@shared/types/Composer";
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
			<div className="relative">
				<div className="overflow-x-auto p-2 markdown-container">
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
		<div>
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
							/>
						) : (
							<code
								{...rest}
								className={`${className} whitespace-pre-wrap bg-transparent p-2`}
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

type ChatFileArtifact = ComposerMessage["plan"]["files"][number];

const ChatArtifact = ({
	file,
	theme,
}: {
	file: ChatFileArtifact;
	theme: { [index: string]: CSSProperties };
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
				},
			});
		}
	};

	const copyToClipboard = (code: string) => {
		vscode.postMessage({
			command: "clipboard",
			value: extractCodeBlock(code),
		});
	};

	const truncatePath = (path: string, maxLength: number = 50) => {
		if (path.length <= maxLength) return path;
		return "..." + path.slice(-maxLength);
	};

	return (
		<div className="border border-stone-700 rounded-lg overflow-hidden shadow-lg mb-4 mt-4">
			<div className="bg-stone-700 text-white flex flex-wrap items-center">
				<h4 className="m-0 flex-grow p-2 text-wrap break-all">
					{truncatePath(file.path)}
				</h4>
				<div className="flex">
					<div className="flex items-center bg-stone-700 text-white rounded z-10 hover:bg-stone-500 hover:cursor-pointer">
						<button
							type="button"
							title="Copy code to clipboard"
							className="p-4"
							onClick={() => copyToClipboard(file.code!)}
						>
							<FaCopy size={18} />
						</button>
					</div>
					<div className="flex items-center bg-stone-700 text-white rounded z-10 hover:bg-stone-500 hover:cursor-pointer">
						<button
							type="button"
							title="Show diff"
							className="p-4"
							onClick={() => showDiffview()}
						>
							<MdOutlineDifference size={18} />
						</button>
					</div>
					<div className="flex items-center bg-stone-700 text-white rounded z-10 hover:bg-stone-500 hover:cursor-pointer">
						<button
							type="button"
							title="Accept changes"
							className="p-4"
							onClick={() => mergeIntoFile()}
						>
							<LuFileCheck size={18} />
						</button>
					</div>
				</div>
			</div>
			<div className="p-2 bg-editor-bg">
				{file.changes?.length && file.changes?.length > 0 && (
					<div className="mb-4 p-2">
						<h4 className="m-0 text-md font-semibold">Changes:</h4>
						<ul className="mt-2 list-disc list-inside">
							{file.changes?.map((change, index) => (
								<li key={index} className="ml-4 !border-t-0">
									{typeof change === "string"
										? change
										: JSON.stringify(change)}
								</li>
							))}
						</ul>
					</div>
				)}
			</div>
		</div>
	);
};

const ChatEntry = ({
	from,
	message,
	loading,
	plan,
	index,
	image,
}: PropsWithChildren<ComposerMessage & { index: number }>) => {
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

	return (
		<li
			className="pt-2 pb-2 tracking-wide leading-relaxed text-base message"
			style={
				index === 0
					? {}
					: {
							borderTop: "1px solid",
							borderColor:
								"rgb(87 83 78 / var(--tw-border-opacity))",
					  }
			}
		>
			<span className="flex items-center mb-4">
				<h3 className="text-xl">
					{from === "user" ? "Me" : "Wingman"}
				</h3>
			</span>
			{message !== "" && renderMarkdown(message, codeTheme)}
			{image && (
				<img
					src={image.data}
					alt="Image preview"
					className="max-w-full h-auto rounded-lg mt-4 mb-4"
					style={{ maxHeight: "512px" }}
				/>
			)}
			{loading && (
				<div className="mt-4">
					<SkeletonLoader isDarkTheme={!isLightTheme} />
				</div>
			)}
			{plan?.steps.length > 0 && (
				<div>
					<div className="flex flex-col bg-editor-bg mt-4 rounded-lg">
						<h3 className="m-0 text-lg">Steps:</h3>
						{plan.steps?.map((step, index) => (
							<div
								className="border border-stone-700 rounded-lg overflow-hidden shadow-lg mb-4 mt-4"
								key={index}
							>
								<div className="bg-stone-700 text-white flex flex-row">
									<p className="flex-1 p-2">
										{step.description}
									</p>
									{step.command && (
										<div className="flex space-x-2 bg-stone-700 text-white rounded hover:bg-stone-500 hover:cursor-pointer z-10">
											<button
												type="button"
												title="Run in terminal"
												className="p-4"
												onClick={() =>
													sendTerminalCommand(
														step.command!
													)
												}
											>
												<FaTerminal size={18} />
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
			{plan?.files?.length > 0 && (
				<div>
					<h3 className="m-0 text-lg mt-4">Files:</h3>
					{plan?.files?.map((file, index) => (
						<ChatArtifact
							key={index}
							file={file}
							theme={codeTheme}
						/>
					))}
				</div>
			)}
		</li>
	);
};

export default ChatEntry;
