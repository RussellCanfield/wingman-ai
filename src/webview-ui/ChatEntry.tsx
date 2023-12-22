import { PropsWithChildren, memo } from "react";
import Markdown from "react-markdown";
import styled, { keyframes } from "styled-components";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { a11yDark } from "react-syntax-highlighter/dist/esm/styles/prism";
import { ChatMessage } from "../types/Message";
import { FaCopy } from "react-icons/fa6";
import { GoFileSymlinkFile } from "react-icons/go";

const Entry = styled.li`
	border-bottom: 1px solid rgba(200, 200, 200, 0.5);
	padding: 0px 4px;
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
	border: 2px solid #eee;
	border-bottom-color: transparent;
	border-radius: 50%;
	display: inline-block;
	box-sizing: border-box;
	animation: ${LoaderAnimation} 1s linear infinite;
	margin-left: 8px;
`;

const MarkdownBox = styled.div`
	overflow-x: scroll;
`;

const MarkdownOperationsBox = styled.div`
	display: flex;
	justify-content: flex-end;
`;

const MarkdownOperationsBoxHightlight = styled.div`
	border: 1px solid rgba(200, 200, 200, 0.5);
	padding: 4px;
	display: flex;
	gap: 12px;
`;

const CodeContainer = ({ children }: PropsWithChildren) => {
	return (
		<div>
			<MarkdownOperationsBox>
				<div style={{ flex: "1 0 auto" }}></div>
				<MarkdownOperationsBoxHightlight>
					<FaCopy size={18} />
					<GoFileSymlinkFile size={18} />
				</MarkdownOperationsBoxHightlight>
			</MarkdownOperationsBox>
			<MarkdownBox>{children}</MarkdownBox>
		</div>
	);
};

const ChatEntry = memo(
	({ from, message, loading }: ChatMessage & { loading?: boolean }) => {
		return (
			<Entry>
				<LabelContainer>
					<h3>{from === "User" ? "Me" : "Open Assistant"}</h3>
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
									PreTag={CodeContainer}
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
