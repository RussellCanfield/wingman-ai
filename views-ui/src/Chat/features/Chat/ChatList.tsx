import { PropsWithChildren, useEffect, useMemo, useRef, useState } from "react";
import { ChatMessage } from "@shared/types/Message";
import ChatEntry from "./ChatEntry";

function ChatResponseList({
	children,
	messages,
}: PropsWithChildren & { messages: ChatMessage[] }) {
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
