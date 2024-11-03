import { CodeReviewMessage } from "@shared/types/Message";
import Markdown from "react-markdown";
import SyntaxHighlighter from "react-syntax-highlighter";
import {
	prism,
	vscDarkPlus,
} from "react-syntax-highlighter/dist/esm/styles/prism";
import { useAppContext } from "../../context";

export interface CodeReviewSummaryProps {
	message: CodeReviewMessage;
}

export default function CodeReviewSummary({ message }: CodeReviewSummaryProps) {
	const { isLightTheme } = useAppContext();

	const codeTheme = isLightTheme ? prism : vscDarkPlus;

	return (
		<li className="border-b border-gray-300 border-opacity-50 pb-4 text-base message">
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
		</li>
	);
}
