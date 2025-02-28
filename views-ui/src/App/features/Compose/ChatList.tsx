import { type PropsWithChildren, useCallback, useEffect, useMemo, useRef } from "react";
import ChatEntry from "./ChatEntry";
import type { ComposerMessage } from "@shared/types/v2/Composer";

function ChatResponseList({
	children,
	messages,
}: PropsWithChildren & { messages: ComposerMessage[] }) {
	const ulRef = useRef<HTMLUListElement>(null);
	const ref = useRef<HTMLDivElement>(null);

	const scrollToBottom = useCallback(() => {
		if (ref.current) {
			ref.current.scrollIntoView({ block: "nearest" });
		}
	}, []);

	useEffect(() => {
		scrollToBottom();
	}, [scrollToBottom]);

	const chatHistory = useMemo(() => {
		return messages.map(({ from, message, events, image }, index) => (
			<ChatEntry
				// biome-ignore lint/suspicious/noArrayIndexKey: <explanation>
				key={index}
				from={from}
				loading={false}
				message={message}
				events={events}
				image={image}
				isCurrent={index === messages.length - 1}
			/>
		));
	}, [messages]);

	return (
		<ul
			ref={ulRef}
			className="flex-1 overflow-x-hidden overflow-y-auto list-none m-0 p-0 pr-2"
		>
			{chatHistory}
			{children}
			<div ref={ref} />
		</ul>
	);
}

export default ChatResponseList;
