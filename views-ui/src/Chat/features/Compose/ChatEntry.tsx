import { CSSProperties, PropsWithChildren, memo, useState } from "react";
import { FaC, FaCopy } from "react-icons/fa6";
import { GoFileSymlinkFile } from "react-icons/go";
import Markdown from "react-markdown";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { FaTerminal } from "react-icons/fa";
import {
	prism,
	vscDarkPlus,
} from "react-syntax-highlighter/dist/esm/styles/prism";
import { FileMetadata } from "@shared/types/Message";
import { vscode } from "../../utilities/vscode";
import { useAppContext } from "../../context";
import { Loader } from "../../Loader";
import { ComposerMessage } from "@shared/types/Composer";

export function extractCodeBlock(text: string) {
	const regex = /```.*?\n([\s\S]*?)\n```/g;
	const matches = [];
	let match;
	while ((match = regex.exec(text)) !== null) {
		matches.push(match[1]);
	}
	return matches.join("\n");
}

type MarkDownObject = {
	props: {
		children: [boolean, MarkDownEntry[] | string];
	};
};

type MarkDownEntry = {
	props: {
		children: string[];
	};
};

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

	const copyToClipboard = (code: string) => {
		vscode.postMessage({
			command: "clipboard",
			value: extractCodeBlock(code),
		});
	};

	return (
		<div className="border border-stone-800 rounded-lg overflow-hidden shadow-lg mb-4 mt-4">
			<div className="bg-stone-800 text-white flex flex-row">
				<h4 className="m-0 flex-1 p-2">File: {file.file}</h4>
				<div className="flex sp bg-stone-800 text-white rounded z-10 pl-2 pr-2 hover:bg-stone-500 hover:cursor-pointer">
					<button
						type="button"
						title="Copy code to clipboard"
						onClick={() => copyToClipboard(file.code!)}
					>
						<FaCopy size={16} />
					</button>
				</div>
				<div className="flex sp ml-2 bg-stone-800 text-white rounded z-10 pl-2 pr-2 hover:bg-stone-500 hover:cursor-pointer">
					<button
						type="button"
						title="Merge into file"
						onClick={() => mergeIntoFile()}
					>
						<GoFileSymlinkFile size={16} />
					</button>
				</div>
			</div>
			<div className="p-2 bg-editor-bg">
				{file.changes?.length && file.changes?.length > 0 && (
					<div className="mb-4 border border-stone-800 rounded-lg p-2">
						<h4 className="m-0 text-md font-semibold">Changes:</h4>
						<ul className="mt-2 list-disc list-inside">
							{file.changes?.map((change, index) => (
								<li key={index} className="ml-4 !border-t-0">
									{change}
								</li>
							))}
						</ul>
					</div>
				)}
				<div>{renderMarkdown(file?.code || "", theme, file)}</div>
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
}: PropsWithChildren<ComposerMessage & { index: number }>) => {
	const { isLightTheme } = useAppContext();
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
			className="pt-2 pb-2 tracking-wide leading-relaxed text-base"
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
				{loading && <Loader />}
			</span>
			{message !== "" && renderMarkdown(message, codeTheme)}
			{plan?.steps.length > 0 && (
				<div className="p-2">
					<div className="flex flex-col bg-editor-bg mt-4 rounded-lg">
						<h3 className="m-0 text-lg">Steps:</h3>
						{plan.steps?.map((step, index) => (
							<div className="border border-stone-800 rounded-lg overflow-hidden shadow-lg mb-4 mt-4">
								<div className="bg-stone-800 text-white flex flex-row">
									<p className="flex-1 p-2">
										{step.description}
									</p>
									{step.command && (
										<div className="flex space-x-2 p-2 bg-stone-800 text-white rounded hover:bg-stone-500 hover:cursor-pointer z-10">
											<button
												type="button"
												title="Run in terminal"
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
			{plan?.files?.map((file, index) => (
				<ChatArtifact key={index} file={file} theme={codeTheme} />
			))}
		</li>
	);
};

export default ChatEntry;
