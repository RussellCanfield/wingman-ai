import { CodeReviewMessage } from "@shared/types/Message";
import Markdown from "react-markdown";
import SyntaxHighlighter from "react-syntax-highlighter";
import {
	prism,
	vscDarkPlus,
} from "react-syntax-highlighter/dist/esm/styles/prism";
import { vscode } from "../../utilities/vscode";
import { useAppContext } from "../../context";

export interface CodeReviewSummaryProps {
	message: CodeReviewMessage;
}

export default function CodeReviewSummary({ message }: CodeReviewSummaryProps) {
	const { isLightTheme } = useAppContext();

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
