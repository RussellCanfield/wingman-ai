import { type PropsWithChildren, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ChatThread } from "./ChatThreadEntry";
import { useComposerContext } from "../../context/composerContext";

function ChatThreadList({
	children,
	loading
}: PropsWithChildren & { loading: boolean }) {
	const { activeComposerState, activeThread, composerStates } = useComposerContext();
	const ulRef = useRef<HTMLUListElement>(null);
	const bottomRef = useRef<HTMLDivElement>(null);
	const [previousMessageCount, setPreviousMessageCount] = useState(0);
	const [shouldAutoScroll, setShouldAutoScroll] = useState(true);

	// Simple scroll to bottom function
	const scrollToBottom = useCallback(() => {
		if (bottomRef.current) {
			bottomRef.current.scrollIntoView({ behavior: "smooth", block: "end" });
		}
	}, []);

	// Track scroll position to determine if we should auto-scroll
	const handleScroll = useCallback(() => {
		if (!ulRef.current) return;

		const { scrollTop, scrollHeight, clientHeight } = ulRef.current;
		const isAtBottom = Math.abs(scrollHeight - clientHeight - scrollTop) < 50; // Using a small threshold
		setShouldAutoScroll(isAtBottom);
	}, []);

	// Add scroll event listener
	useEffect(() => {
		const ul = ulRef.current;
		if (ul) {
			ul.addEventListener('scroll', handleScroll);
			return () => ul.removeEventListener('scroll', handleScroll);
		}
	}, [handleScroll]);

	// Scroll on new messages only if we're at the bottom
	// biome-ignore lint/correctness/useExhaustiveDependencies: <explanation>
	useEffect(() => {
		const currentMessageCount = activeComposerState?.messages.length || 0;
		const hasNewMessages = currentMessageCount > previousMessageCount;

		if (hasNewMessages && (shouldAutoScroll || activeComposerState?.messages[currentMessageCount - 1]?.role === "user")) {
			scrollToBottom();
		}

		setPreviousMessageCount(currentMessageCount);
	}, [activeComposerState?.messages.length, scrollToBottom, shouldAutoScroll]);

	const state = useMemo(() => {
		if (!activeThread || !activeComposerState) return null;
		return activeThread.id === activeComposerState.threadId ? activeComposerState : composerStates.find(s => s.threadId === activeThread.id);
	}, [activeComposerState, activeThread, composerStates]);

	if (!state) return null;

	return (
		<ul
			ref={ulRef}
			className="flex-1 overflow-x-hidden overflow-y-auto list-none m-0 p-0 pr-2"
			style={{ scrollBehavior: 'smooth' }}
		>
			<ChatThread state={state} loading={loading} />
			{children}
			<div ref={bottomRef} style={{ height: '1px', width: '100%' }} />
		</ul>
	);
}

export default ChatThreadList;