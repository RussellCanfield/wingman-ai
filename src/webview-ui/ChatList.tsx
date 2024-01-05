import { PropsWithChildren, useEffect, useMemo, useRef, useState } from "react";
import styled from "styled-components";
import { ChatMessage } from "../types/Message";
import ChatEntry from "./ChatEntry";

const ChatResponses = styled.ul`
	flex: 1 0;
	overflow-x: hidden;
	overflow-y: scroll;
	list-style-type: none;
	margin: 0;
	padding: 0;
`;

function ChatResponseList({
	children,
	messages,
}: PropsWithChildren & { messages: ChatMessage[] }) {
	const ulRef = useRef<HTMLUListElement>(null);
	const ref = useRef<HTMLDivElement>(null);
	const [userHasScrolled, setUserHasScrolled] = useState(false);

	useEffect(() => {
		if (ref.current && !userHasScrolled) {
			ref.current.scrollIntoView({ block: "nearest" });
		}
	});

	useEffect(() => {
		if (ref.current) {
			const observer = new IntersectionObserver(
				(entries) => {
					setUserHasScrolled(!entries[0].isIntersecting);
				},
				{
					root: ulRef.current,
					rootMargin: "0px",
					threshold: 1.0,
				}
			);

			observer.observe(ref.current as unknown as Element);

			return () => {
				observer.disconnect();
			};
		}
	});

	const chatHistory = useMemo(() => {
		return messages.map(({ from, message, context }, index) => (
			<ChatEntry
				key={index}
				from={from}
				message={message}
				context={context}
			/>
		));
	}, [messages]);

	return (
		<ChatResponses ref={ulRef}>
			{chatHistory}
			{children}
			<div ref={ref}></div>
		</ChatResponses>
	);
}

export { ChatResponseList };
