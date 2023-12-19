import { ReactNode, memo } from "react";
import Markdown from "react-markdown";
import styled from "styled-components";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { dark } from "react-syntax-highlighter/dist/esm/styles/prism";
import { ChatMessage } from "./types/Message";

const Entry = styled.div`
	display: flex;
	flex-direction: column;
	border-bottom: 1px solid rgba(200, 200, 200, 0.5);
`;

const Code = styled.code`
	white-space: pre-wrap;
`;

const ChatEntry = memo(
	({ from, message, loader }: ChatMessage & { loader?: ReactNode }) => {
		return (
			<Entry>
				<p>{from === "user" ? "Me" : "Open Assistant"}</p>
				<Markdown
					children={message}
					components={{
						code(props) {
							const { children, className, node, ...rest } =
								props;

							const languageType = /language-(\w+)/.exec(
								className || ""
							);

							return languageType ? (
								<SyntaxHighlighter
									PreTag="div"
									children={String(children).replace(
										/\n$/,
										""
									)}
									style={dark}
									language={languageType[1]}
								/>
							) : (
								<Code {...rest} className={className}>
									{children}
								</Code>
							);
						},
					}}
				/>
				{loader}
			</Entry>
		);
	}
);

export default ChatEntry;
