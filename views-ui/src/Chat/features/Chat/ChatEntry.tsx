import { PropsWithChildren, memo, useCallback, useMemo, useState } from "react";
import { FaCopy, FaUser } from "react-icons/fa6";
import { GoFileSymlinkFile } from "react-icons/go";
import Markdown from "react-markdown";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import {
	prism,
	vscDarkPlus,
} from "react-syntax-highlighter/dist/esm/styles/prism";
import { Message } from "@shared/types/Message";
import { vscode } from "../../utilities/vscode";
import React from "react";
import { SkeletonLoader } from "../../SkeletonLoader";
import "./ChatEntry.css";
import { useSettingsContext } from "../../context/settingsContext";
import { useMessageParser } from "./useMessageParser";
import { ThinkingSection } from "./ThinkingSection";

export type MarkDownObject = {
	props: {
		children: [boolean, MarkDownEntry[] | string];
	};
};

export type MarkDownEntry = {
	props: {
		children: string[];
	};
};

export const CodeContainer = memo((props: PropsWithChildren) => {
	const [toolboxVisible, setToolboxVisible] = useState(false);
	const { isLightTheme } = useSettingsContext();

	/**
	 * Extracts Markdown content from children nodes.
	 */
	const getMarkdownFromChildren = useCallback((): string => {
		const markDown = props.children as MarkDownObject;

		return (markDown.props.children[1] as MarkDownEntry[]).reduce(
			(acc: string, curr: string | MarkDownEntry) => {
				if (typeof curr === "string") {
					acc += curr;
				} else if (curr.props.children) {
					(curr.props.children as unknown as MarkDownEntry[]).forEach((c) => {
						if (typeof c === "string") {
							acc += c;
						} else if (
							curr.props.children &&
							Array.isArray(curr.props.children) &&
							curr.props.children[0] !== undefined
						) {
							acc += c.props.children[0];
						}
					});
				}
				return acc;
			},
			""
		);
	}, [props.children]);

	/**
	 * Sends Markdown content to a new file.
	 */
	const sendToNewFile = useCallback(() => {
		vscode.postMessage({
			command: "copyToFile",
			value: getMarkdownFromChildren(),
		});
	}, [getMarkdownFromChildren]);

	/**
	 * Copies Markdown content to the clipboard.
	 */
	const copyToClipboard = useCallback(() => {
		vscode.postMessage({
			command: "clipboard",
			value: getMarkdownFromChildren(),
		});
	}, [getMarkdownFromChildren]);

	/**
	 * Renders the toolbox with actions (copy & send to file).
	 */
	const Toolbox = useCallback(() => (
		<div className="flex justify-end absolute -top-5 right-1.5 pr-2.5">
			<div className="flex gap-1.5 list-none p-1 bg-[var(--vscode-input-background)] border border-[var(--vscode-input-border)] rounded-md">
				<ToolboxButton
					title="Copy code to clipboard"
					onClick={copyToClipboard}
					icon={<FaCopy size={16} />}
				/>
				<ToolboxButton
					title="Send to new file"
					onClick={sendToNewFile}
					icon={<GoFileSymlinkFile size={16} />}
				/>
			</div>
		</div>
	), [copyToClipboard, sendToNewFile]);

	return (
		<div
			className="relative top-4 pb-3"
			onMouseEnter={() => setToolboxVisible(true)}
			onMouseLeave={() => setToolboxVisible(false)}
		>
			{toolboxVisible && <Toolbox />}
			<div
				className={`overflow-x-auto bg-transparent p-2 mb-4 border-2 ${isLightTheme ? "border-stone-300" : "border-stone-600"
					}`}
			>
				{React.isValidElement(props.children)
					? React.cloneElement(props.children, {
						//@ts-expect-error
						className: "bg-transparent",
					})
					: props.children}
			</div>
		</div>
	);
});

/**
 * ToolboxButton Component
 * A simple button component for toolbox actions (e.g., copy, send to file).
 */
const ToolboxButton = memo(
	({
		title,
		onClick,
		icon,
	}: {
		title: string;
		onClick: () => void;
		icon: React.ReactNode;
	}) => {
		return (
			<div
				className="p-1 rounded transition-colors duration-200 cursor-pointer text-[var(--vscode-input-foreground)] hover:text-white hover:bg-[var(--vscode-input-foreground)]"
				role="button"
				title={title}
				onClick={onClick}
			>
				{icon}
			</div>
		);
	}
);
ToolboxButton.displayName = "ToolboxButton";

const ChatEntry = memo(
	({
		from,
		message,
		loading,
		context,
	}: PropsWithChildren<Omit<Message, "type">>) => {
		const { isLightTheme } = useSettingsContext();
		const { mainContent, thinkingContent, isThinking } = useMessageParser(message);

		const showSelectedContext = useCallback(() => {
			if (!context) {
				return;
			}
			vscode.postMessage({
				command: "showContext",
				value: context,
			});
		}, [context]);

		const contextDisplay = useMemo(() => {
			if (!context) {
				return "";
			}
			const { workspaceName, lineRange, fileName } = context;

			if (workspaceName) {
				try {
					const [, relativeDir] = fileName.split(workspaceName);

					const path = relativeDir.substring(0, relativeDir.lastIndexOf("/"));
					const file = relativeDir.substring(relativeDir.lastIndexOf("/") + 1);

					const pathWithLines = `${path} ${lineRange}`;

					return (
						<div
							className="w-full flex flex-wrap items-center justify-between gap-1 p-2 border rounded-md border-solid border-stone-600 cursor-pointer"
							onClick={showSelectedContext}
						>
							<span>{file}</span>
							<span
								className={`${isLightTheme ? "text-stone-400" : "text-stone-500"
									}`}
							>
								{pathWithLines}
							</span>
						</div>
					);
				} catch (error) {
					console.log(error);
				}
			}

			return null;
		}, [context, isLightTheme, showSelectedContext]);

		const fromUser = from === "user";
		const codeTheme = isLightTheme ? prism : vscDarkPlus;
		const textColor = fromUser ? "text-gray-200" : "text-[var(--vscode-input-foreground)]";
		const bgClasses = fromUser
			? `${!isLightTheme ? "bg-stone-800" : "bg-stone-600"
			} rounded-lg overflow-hidden w-full`
			: "";

		return (
			<li className="tracking-wide leading-relaxed text-md message mb-8">
				<div
					className={`${fromUser ? "" : "pl-[48px]"
						} pr-[16px] items-center} ${textColor}`}
				>
					<div
						className={`relative flex items-center gap-4 flex-grow ${fromUser ? "" : "flex-col"
							}`}
					>
						{fromUser && (
							<div className="flex-shrink-0 w-8 h-8 rounded-full bg-stone-800 flex items-center justify-center">
								<FaUser className="text-stone-200" size={16} />
							</div>
						)}
						{contextDisplay}
						<div
							className={`${bgClasses} flex-grow w-full justify-center items-center break-words ${fromUser ? "shadow-lg p-4" : ""
								}`}
						>
							{(thinkingContent || isThinking) && (
								<ThinkingSection
									content={thinkingContent || ""}
									isThinking={isThinking}
									isLightTheme={isLightTheme}
								/>
							)}
							<Markdown
								children={mainContent}
								components={{
									code(props) {
										const { children, className, ...rest } = props;

										const languageType = /language-(\w+)/.exec(className || "");

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
												className={`whitespace-pre-wrap ${className} bg-transparent`}
											>
												{children}
											</code>
										);
									},
								}}
							/>
						</div>
						{loading && (
							<div className="w-full flex justify-center items-center">
								<SkeletonLoader isDarkTheme={!isLightTheme} />
							</div>
						)}
					</div>
				</div>
			</li>
		);
	}
);

export default ChatEntry;
