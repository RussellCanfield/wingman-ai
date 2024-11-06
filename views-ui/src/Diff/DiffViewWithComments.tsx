import ReactDiffViewer, { DiffMethod } from "../Common/DiffView";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import {
	prism,
	vscDarkPlus,
} from "react-syntax-highlighter/dist/esm/styles/prism";
import "./App.css";
import { memo, PropsWithChildren, useMemo } from "react";
import { CodeReviewComment, FileReviewDetails } from "@shared/types/Message";
import Markdown from "react-markdown";

const CodeContainer = memo(({ children }: PropsWithChildren) => {
	return (
		<div className="relative">
			<div className="overflow-x-auto markdown-container">{children}</div>
		</div>
	);
});

export interface DiffProps {
	reviewDetails: FileReviewDetails;
	isDarkTheme: boolean;
	onDiffAccepted: (
		fileDiff: FileReviewDetails,
		comment: CodeReviewComment
	) => void;
	onDiffRejected: (
		fileDiff: FileReviewDetails,
		comment: CodeReviewComment
	) => void;
}

export default function DiffViewWithComments({
	reviewDetails,
	isDarkTheme,
	onDiffAccepted,
	onDiffRejected,
}: DiffProps) {
	const { file, original, current, comments } = reviewDetails;

	const codeTheme = !isDarkTheme ? prism : vscDarkPlus;
	const commentsMap = useMemo(
		() =>
			comments?.reduce((acc, comment) => {
				if (comment) {
					acc.set(comment.startLine, comment);
				}
				return acc;
			}, new Map<number, CodeReviewComment>()),
		[comments]
	);

	const highlightSyntax = (str: string) => {
		return (
			<SyntaxHighlighter
				language="typescript"
				style={isDarkTheme ? vscDarkPlus : prism}
				PreTag={CodeContainer}
			>
				{str}
			</SyntaxHighlighter>
		);
	};

	const newStyles = {
		variables: {
			dark: {
				diffViewerBackground: "rgb(30, 30, 30)",
				gutterBackground: "rgb(30, 30, 30)",
				diffViewerTitleBackground: "rgb(30, 30, 30)",
				gitterBackground: "rgb(30, 30, 30)",
				highlightBackground: "rgb(30, 30, 30)",
				highlightGutterBackground: "rgb(30, 30, 30)",
				addedBackground: "#2ea04326",
				addedGutterBackground: "#2ea04326",
				wordAddedBackground: "transparent",
			},
		},
		line: {
			padding: "2px",
			minHeight: "27px",
		},
		diffRemoved: {
			padding: "1px",
		},
		wordDiff: {
			padding: "unset",
		},
	};

	return (
		<div className="bg-gray-600 flex flex-col">
			<div
				data-file-id={file}
				className="flex-grow overflow-y-auto relative"
			>
				<ReactDiffViewer
					oldValue={original}
					newValue={current}
					styles={newStyles}
					compareMethod={DiffMethod.CHARS}
					splitView={false}
					useDarkTheme={isDarkTheme}
					showDiffOnly={true}
					renderContent={highlightSyntax}
					onLineRender={(number) => {
						const comment = commentsMap?.get(number);
						if (!comment || comment.rejected || comment.accepted)
							return null;

						return (
							<div
								key={number}
								className="p-2 border-t-2 border-t-gray-600 border-b-2 border-b-gray-600"
							>
								<h3 className="text-xl">Wingman</h3>
								<div className="p-2">
									<p>{comment.body}</p>
									<div
										className={`${
											isDarkTheme
												? "bg-code-dark"
												: "bg-code-light"
										} mt-4`}
									>
										<Markdown
											components={{
												code(props) {
													const {
														children,
														className,
														node,
														...rest
													} = props;

													const languageType =
														/language-(\w+)/.exec(
															className || ""
														);

													return languageType ? (
														<SyntaxHighlighter
															children={String(
																children
															).replace(
																/\n$/,
																""
															)}
															style={codeTheme}
															language={
																languageType[1]
															}
															wrapLines={true}
															wrapLongLines={true}
															PreTag={
																CodeContainer
															}
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
										>
											{comment.code}
										</Markdown>
									</div>
								</div>
								<div className="flex justify-start gap-4 mt-2">
									{comment?.action && (
										<button
											className="bg-green-600 hover:bg-green-700 text-white px-2 py-1 rounded"
											type="button"
											onClick={() => {
												onDiffAccepted(
													reviewDetails,
													comment!
												);
											}}
										>
											Accept
										</button>
									)}
									{comment?.action && (
										<button
											className="bg-red-600 hover:bg-red-700 text-white px-2 py-1 rounded"
											type="button"
											onClick={() => {
												onDiffRejected(
													reviewDetails,
													comment!
												);
											}}
										>
											Reject
										</button>
									)}
								</div>
							</div>
						);
					}}
				/>
			</div>
		</div>
	);
}
