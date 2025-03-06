import { type PropsWithChildren, useCallback, useEffect, useMemo, useRef } from "react";
import ChatEntry from "./ChatEntry";
import type { ComposerMessage } from "@shared/types/Composer";

function ChatResponseList({
	children,
	messages,
	loading
}: PropsWithChildren & { messages: ComposerMessage[], loading: boolean }) {
	const ulRef = useRef<HTMLUListElement>(null);
	const bottomRef = useRef<HTMLDivElement>(null);

	const scrollToBottom = useCallback(() => {
		// Add a small delay to ensure content is rendered
		setTimeout(() => {
			if (bottomRef.current) {
				bottomRef.current.scrollIntoView({
					behavior: "smooth",
					block: "end",
				});
			}
		}, 100);
	}, []);

	// Scroll on new messages or loading state change
	// biome-ignore lint/correctness/useExhaustiveDependencies: <explanation>
	useEffect(() => {
		scrollToBottom();
	}, [messages.length, loading, scrollToBottom]);

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
				isCurrent={!loading && index === messages.length - 1}
			/>
		));
	}, [messages, loading]);

	return (
		<ul
			ref={ulRef}
			className="flex-1 overflow-x-hidden overflow-y-auto list-none m-0 p-0 pr-2"
			style={{ scrollBehavior: 'smooth' }}
		>
			{chatHistory}
			{children}
			<div ref={bottomRef} style={{ height: '1px', width: '100%' }} />
		</ul>
	);
}

export default ChatResponseList;