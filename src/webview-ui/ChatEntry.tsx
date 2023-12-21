import { ReactNode, memo } from "react";
import Markdown from "react-markdown";
import styled, { keyframes } from "styled-components";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { a11yDark } from "react-syntax-highlighter/dist/esm/styles/prism";
import { ChatMessage } from "./types/Message";

const Entry = styled.li`
	border-bottom: 1px solid rgba(200, 200, 200, 0.5);
	padding: 0px 2px;
`;

const Code = styled.code`
	white-space: pre-wrap;
`;

const LoaderAnimation = keyframes`
  	0% {
        transform: rotate(0deg);
	}
	100% {
		transform: rotate(360deg);
	}
`;

const LabelContainer = styled.span`
	display: flex;
	align-items: center;
`;

const Loader = styled.span`
	width: 16px;
	height: 16px;
	border: 2px solid #fff;
	border-bottom-color: transparent;
	border-radius: 50%;
	display: inline-block;
	box-sizing: border-box;
	animation: ${LoaderAnimation} 1s linear infinite;
	margin-left: 8px;
`;

const ChatEntry = memo(
	({ from, message, loading }: ChatMessage & { loading?: boolean }) => {
		return (
			<Entry>
				<LabelContainer>
					<h3>{from === "user" ? "Me" : "Open Assistant"}</h3>
					{loading && <Loader />}
				</LabelContainer>
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
									style={a11yDark}
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
			</Entry>
		);
	}
);

export default ChatEntry;
