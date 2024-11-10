import { CodeReviewMessage } from "@shared/types/Message";
import Markdown from "react-markdown";
import SyntaxHighlighter from "react-syntax-highlighter";
import {
	prism,
	vscDarkPlus,
} from "react-syntax-highlighter/dist/esm/styles/prism";
import { vscode } from "../../utilities/vscode";
import { useSettingsContext } from "../../context/settingsContext";

export interface CodeReviewSummaryProps {
	message: CodeReviewMessage;
}

export default function CodeReviewSummary({ message }: CodeReviewSummaryProps) {
	const { isLightTheme } = useSettingsContext();

	const codeTheme = isLightTheme ? prism : vscDarkPlus;

	const reviewFiles = () => {
		vscode.postMessage({
			command: "review-files",
			value: message,
		});
	};

	return (
		<li className="border-b border-stone-500 border-opacity-50 pb-4 text-base message">
			<span className="flex items-center">
				<h3 className="text-lg">Wingman</h3>
			</span>
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
				{message.review.summary}
			</Markdown>
			<div className="mb-4 p-4 bg-amber-50 dark:bg-amber-900/20 border-l-4 border-amber-500 rounded-r">
				<p className="text-amber-800 dark:text-amber-200 text-sm flex items-center gap-2">
					<svg
						className="w-8 h-8 inline-block"
						fill="none"
						stroke="currentColor"
						viewBox="0 0 24 24"
					>
						<path
							strokeLinecap="round"
							strokeLinejoin="round"
							strokeWidth={2}
							d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
						/>
					</svg>
					Note: Code Reviews are still a work in progress. Please
					carefully review modifications before accepting suggestions.
					Using Ollama as a provider may not yield code comments.
				</p>
			</div>
			{message.review.fileDiffMap &&
				Object.keys(message.review.fileDiffMap).length > 0 && (
					<div className="flex items-center justify-center">
						<button
							className="mt-4 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors"
							type="button"
							onClick={reviewFiles}
						>
							Review File-By-File
						</button>
					</div>
				)}
		</li>
	);
}
