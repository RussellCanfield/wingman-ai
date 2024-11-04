import Markdown from "react-markdown";
import {
	AppMessage,
	CodeReview,
	FileDetails,
	FileReviewDetails,
} from "@shared/types/Message";
import {
	prism,
	vscDarkPlus,
} from "react-syntax-highlighter/dist/esm/styles/prism";
import SyntaxHighlighter from "react-syntax-highlighter";
import { useEffect, useState } from "react";
import { vscode } from "./utilities/vscode";
import DiffViewWithComments from "./DiffViewWithComments";

export interface CodeReviewProps {
	review: CodeReview;
	isDarkTheme: boolean;
}

const SkeletonLoader = () => {
	return (
		<div className="bg-gray-900 rounded-lg overflow-hidden shadow-lg animate-pulse w-full">
			<div className="p-4">
				<div className="h-4 bg-gray-700 rounded mb-2"></div>
				<div className="h-4 bg-gray-700 rounded mb-2"></div>
				<div className="h-4 bg-gray-700 rounded mb-2"></div>
				<div className="h-4 bg-gray-700 rounded mb-2"></div>
				<div className="h-4 bg-gray-700 rounded mb-2"></div>
			</div>
		</div>
	);
};

export default function CodeReviewFileByFile({
	review,
	isDarkTheme,
}: CodeReviewProps) {
	const [fileReviews, setFileReviews] = useState<
		Map<string, FileReviewDetails>
	>(() => {
		return new Map(Object.entries(review.fileDiffMap ?? {}));
	});
	const [currentFileInReview, setCurrentFileInReview] = useState<
		string | undefined
	>();

	const codeTheme = !isDarkTheme ? prism : vscDarkPlus;

	useEffect(() => {
		window.addEventListener("message", handleResponse);

		return () => {
			window.removeEventListener("message", handleResponse);
		};
	}, []);

	useEffect(() => {
		const nextFileToReview = Array.from(fileReviews.entries()).find(
			([_, details]) => !details.comments
		);

		if (nextFileToReview && nextFileToReview[0] !== currentFileInReview) {
			setCurrentFileInReview(nextFileToReview[0]);
			vscode.postMessage({
				command: "get-code-review-file",
				value: {
					diff: nextFileToReview[1].diff!,
					file: nextFileToReview[0],
				} satisfies FileDetails,
			});
		}
	}, [fileReviews]);

	const handleResponse = (event: MessageEvent<AppMessage>) => {
		const { data } = event;
		const { command, value } = data;

		switch (command) {
			case "code-review-file-result":
				const fileReview = value as FileReviewDetails;
				console.log(fileReview);

				if (fileReviews.has(fileReview.file)) {
					setFileReviews((reviews) => {
						reviews.set(fileReview.file, fileReview);
						return reviews;
					});
					setCurrentFileInReview(undefined);
				}
				break;
		}
	};

	return (
		<section>
			<Markdown
				components={{
					code(props) {
						const { children, className, node, ...rest } = props;

						const languageType = /language-(\w+)/.exec(
							className || ""
						);

						return languageType ? (
							<SyntaxHighlighter
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
			>
				{review.summary}
			</Markdown>
			<div className="flex flex-row gap-4 mt-8 text-base">
				{Array.from(fileReviews)
					.filter(([_, details]) => details.comments?.length === 0)
					.map(([file, details]) => (
						<div className="w-full text-[var(--vscode-input-foreground)] border border-[var(--vscode-input-border)] bg-[var(--vscode-input-background)] rounded-md">
							<p className="mb-2 p-2 font-bold">{file}</p>
							<DiffViewWithComments
								key={file}
								reviewDetails={details}
								isDarkTheme={isDarkTheme}
							/>
						</div>
					))}
				{currentFileInReview && <SkeletonLoader />}
			</div>
		</section>
	);
}
