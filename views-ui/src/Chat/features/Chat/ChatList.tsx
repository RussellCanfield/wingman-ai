import { PropsWithChildren, useEffect, useMemo, useRef, useState } from "react";
import { BaseMessage, CodeReviewMessage, Message } from "@shared/types/Message";
import ChatEntry from "./ChatEntry";
import CodeReviewSummary from "./CodeReviewSummary";

function ChatResponseList({
	children,
	messages,
}: PropsWithChildren & { messages: BaseMessage[] }) {
	const ulRef = useRef<HTMLUListElement>(null);
	const ref = useRef<HTMLDivElement>(null);
	const [userHasScrolled, setUserHasScrolled] = useState(false);

	const scrollToBottom = () => {
		if (ref.current) {
			ref.current.scrollIntoView({ block: "nearest" });
		}
	};

	useEffect(() => {
		scrollToBottom();
	}, [messages]);

	useEffect(() => {
		if (ref.current && ulRef.current) {
			const observer = new IntersectionObserver(
				(entries) => {
					if (!entries[0].isIntersecting) {
						setUserHasScrolled(true);
						return;
					}

					setUserHasScrolled(false);
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
	}, [ulRef.current]);

	const chatHistory = useMemo(() => {
		return messages.map((message, index) => {
			switch (message.type) {
				case "chat":
					const { from, message: body, context } = message as Message;
					return (
						<ChatEntry
							key={`${message.type}-${index}`}
							from={from}
							message={body}
							context={context}
						/>
					);
				case "code-review":
					return (
						<CodeReviewSummary
							key={`${message.type}-${index}`}
							message={message as CodeReviewMessage}
						/>
					);
				default:
					return null;
			}
		});
	}, [messages]);

	return (
		<ul
			ref={ulRef}
			className="flex-1 overflow-x-hidden overflow-y-auto list-none m-0 p-0"
		>
			{chatHistory}
			{children}
			<div ref={ref}></div>
		</ul>
	);
}

export { ChatResponseList };
