import { PropsWithChildren, memo, useState } from "react";
import { FaCopy } from "react-icons/fa6";
import { GoFileSymlinkFile } from "react-icons/go";
import Markdown from "react-markdown";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import {
	prism,
	vscDarkPlus,
} from "react-syntax-highlighter/dist/esm/styles/prism";
import { ChatMessage } from "@shared/types/Message";
import { vscode } from "../../utilities/vscode";
import { useAppContext } from "../../context";
import React from "react";
import { SkeletonLoader } from "../../SkeletonLoader";

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

const CodeContainer = memo(({ children }: PropsWithChildren) => {
	const [toolboxVisible, setToolboxVisible] = useState(false);
	const { isLightTheme } = useAppContext();

	const getMarkdownFromChildren = () => {
		const markDown = children as MarkDownObject;

		return (markDown.props.children[1] as MarkDownEntry[]).reduce(
			(acc: string, curr: string | MarkDownEntry) => {
				if (typeof curr === "string") {
					acc += curr;
				} else if (curr.props) {
					acc += curr.props.children[0];
				}

				return acc;
			},
			""
		);
	};

	const sendToNewFile = () => {
		vscode.postMessage({
			command: "copyToFile",
			value: getMarkdownFromChildren(),
		});
	};

	const copyToClipboard = () => {
		vscode.postMessage({
			command: "clipboard",
			value: getMarkdownFromChildren(),
		});
	};

	return (
		<div
			className="relative top-4 pb-3"
			onMouseEnter={() => setToolboxVisible(true)}
			onMouseLeave={() => setToolboxVisible(false)}
		>
			{toolboxVisible && (
				<div className="flex justify-end absolute -top-5 right-1.5 pr-2.5">
					<div className="flex-1"></div>
					<ul className="flex gap-1.5 list-none p-1 bg-[var(--vscode-input-background)] border border-[var(--vscode-input-border)] rounded-md">
						<li
							className="p-1 rounded transition-colors duration-200 cursor-pointer text-[var(--vscode-input-foreground)] hover:text-white hover:bg-[var(--vscode-input-foreground)]"
							role="button"
							title="Copy code to clipboard"
							onClick={copyToClipboard}
						>
							<FaCopy size={16} />
						</li>
						<li
							className="p-1 rounded transition-colors duration-200 cursor-pointer text-[var(--vscode-input-foreground)] hover:text-white hover:bg-[var(--vscode-input-foreground)]"
							role="button"
							title="Send to new file"
							onClick={sendToNewFile}
						>
							<GoFileSymlinkFile size={16} />
						</li>
					</ul>
				</div>
			)}
			<div
				className={`overflow-x-auto bg-transparent p-2 mb-4 border-2 ${
					isLightTheme ? "border-stone-300" : "border-stone-600"
				}`}
			>
				{React.isValidElement(children)
					? React.cloneElement(children, {
							//@ts-expect-error
							className: "bg-transparent",
					  })
					: children}
			</div>
		</div>
	);
});

const ChatEntry = ({
	from,
	message,
	loading,
	context,
}: PropsWithChildren<ChatMessage>) => {
	const { isLightTheme } = useAppContext();

	const getContextDisplay = (): string => {
		if (!context) {
			return "";
		}
		const { workspaceName, lineRange, fileName } = context;

		if (workspaceName) {
			try {
				const [, relativeDir] = fileName.split(workspaceName);

				const path = relativeDir.substring(
					0,
					relativeDir.lastIndexOf("/")
				);
				const file = relativeDir.substring(
					relativeDir.lastIndexOf("/") + 1,
					relativeDir.length
				);
				return `${file} ${path} ${lineRange}`;
			} catch (error) {
				console.log(error);
			}
		}

		return "";
	};

	const showSelectedContext = () => {
		if (!context) {
			return;
		}

		vscode.postMessage({
			command: "showContext",
			value: context,
		});
	};

	const codeTheme = isLightTheme ? prism : vscDarkPlus;

	return (
		<li className="border-b border-gray-300 border-opacity-50 pb-4">
			<span className="flex items-center mb-2 mt-2">
				<h3 className="text-lg">
					{from === "user" ? "Me" : "Wingman"}
				</h3>
			</span>
			<div className="mb-4 mt-4">
				{context && (
					<div
						className="flex items-center gap-1 p-1 border border-solid cursor-pointer"
						onClick={showSelectedContext}
					>
						<i className="codicon codicon-file"></i>
						<span>{getContextDisplay()}</span>
					</div>
				)}
			</div>
			{loading && message == "" ? (
				<div>
					<SkeletonLoader />
				</div>
			) : null}
			<Markdown
				children={message}
				components={{
					code(props) {
						const { children, className, node, ...rest } = props;

						const languageType = /language-(\w+)/.exec(
							className || ""
						);

						return languageType ? (
							<SyntaxHighlighter
								PreTag={CodeContainer}
								children={String(children).replace(/\n$/, "")}
								style={codeTheme}
								language={languageType[1]}
								wrapLines={true}
								wrapLongLines={true}
							/>
						) : (
							<code
								{...rest}
								className={`whitespace-pre-wrap ${className} bg-transparent mt-2`}
							>
								{children}
							</code>
						);
					},
				}}
			/>
		</li>
	);
};

export default ChatEntry;
