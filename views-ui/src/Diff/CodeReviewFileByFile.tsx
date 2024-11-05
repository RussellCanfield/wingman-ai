import Markdown from "react-markdown";
import {
	AppMessage,
	CodeReview,
	CodeReviewComment,
	FileDetails,
	FileReviewDetails,
} from "@shared/types/Message";
import {
	prism,
	vscDarkPlus,
} from "react-syntax-highlighter/dist/esm/styles/prism";
import SyntaxHighlighter from "react-syntax-highlighter";
import { useEffect, useMemo, useState } from "react";
import { vscode } from "./utilities/vscode";
import DiffViewWithComments from "./DiffViewWithComments";
import { SkeletonLoader } from "./SkeletonLoader";

export interface CodeReviewProps {
	review: CodeReview;
	isDarkTheme: boolean;
}

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

				if (fileReviews.has(fileReview.file)) {
					setFileReviews((reviews) => {
						const newReviews = new Map(reviews);
						newReviews.set(fileReview.file, fileReview);
						return newReviews;
					});
					setCurrentFileInReview(undefined);
				}
				break;
		}
	};

	const comments = useMemo(() => {
		return Array.from(fileReviews.entries())
			.filter(([_, details]) => {
				return (
					details.comments &&
					Array.isArray(details.comments) &&
					details.comments.length > 0
				);
			})
			.map(([_, details]) => details);
	}, [fileReviews]);

	const onDiffAccepted = (
		fileDiff: FileReviewDetails,
		comment: CodeReviewComment
	) => {
		vscode.postMessage({
			command: "accept-file-diff",
			value: {
				fileDiff,
				comment,
			},
		});

		setFileReviews((reviews) => {
			comment.accepted = true;
			const newReviews = new Map(reviews);
			newReviews.set(fileDiff.file, fileDiff);
			return newReviews;
		});
	};

	const onDiffRejected = (
		fileDiff: FileReviewDetails,
		comment: CodeReviewComment
	) => {
		setFileReviews((reviews) => {
			comment.rejected = true;
			const newReviews = new Map(reviews);
			newReviews.set(fileDiff.file, fileDiff);
			return newReviews;
		});
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
			<div className="flex flex-col gap-4 mt-8 text-base mb-4">
				{comments.map((details) => (
					<div
						key={details.file}
						className="w-full text-[var(--vscode-input-foreground)] border border-[var(--vscode-input-border)] bg-[var(--vscode-input-background)] rounded-md shadow-sm"
					>
						<p className="p-3 font-bold">{details.file}</p>
						<DiffViewWithComments
							key={details.file}
							reviewDetails={details}
							isDarkTheme={isDarkTheme}
							onDiffAccepted={onDiffAccepted}
							onDiffRejected={onDiffRejected}
						/>
					</div>
				))}
				{currentFileInReview && (
					<SkeletonLoader isDarkTheme={isDarkTheme} />
				)}
			</div>
		</section>
	);
}
