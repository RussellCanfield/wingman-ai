import { type PropsWithChildren, useCallback, useEffect, useMemo, useRef } from "react";
import { ChatThread } from "./ChatThreadEntry";
import { useComposerContext } from "../../context/composerContext";

function ChatThreadList({
	children,
	loading
}: PropsWithChildren & { loading: boolean }) {
	const { activeComposerState, activeThread, composerStates } = useComposerContext();
	const ulRef = useRef<HTMLUListElement>(null);
	const bottomRef = useRef<HTMLDivElement>(null);
	// Use a ref to track scroll position without causing re-renders on every scroll event.
	const shouldAutoScrollRef = useRef(true);

	// Scroll to the bottom of the chat list.
	const scrollToBottom = useCallback(() => {
		// Defer the scroll action to ensure the DOM is updated with the new message first.
		setTimeout(() => {
			if (bottomRef.current) {
				// Use 'auto' for an instantaneous scroll, which feels more responsive for new messages.
				bottomRef.current.scrollIntoView({ behavior: "auto", block: "end" });
			}
		}, 0);
	}, []);

	// Update the scroll reference based on the user's scroll position.
	const handleScroll = useCallback(() => {
		const listElement = ulRef.current;
		if (!listElement) return;

		const { scrollTop, scrollHeight, clientHeight } = listElement;
		// If the user is within a certain threshold of the bottom, we'll keep auto-scrolling.
		const isAtBottom = scrollHeight - clientHeight - scrollTop < 100; // Increased threshold for robustness
		shouldAutoScrollRef.current = isAtBottom;
	}, []);

	// Attach the scroll event listener to the list.
	useEffect(() => {
		const listElement = ulRef.current;
		if (listElement) {
			listElement.addEventListener('scroll', handleScroll);
			return () => listElement.removeEventListener('scroll', handleScroll);
		}
	}, [handleScroll]);

	// This is the core effect that triggers auto-scrolling.
	// It runs whenever new messages are added or the loading state changes.
	// biome-ignore lint/correctness/useExhaustiveDependencies: <explanation>
	useEffect(() => {
		const messages = activeComposerState?.messages ?? [];
		const lastMessage = messages[messages.length - 1];

		// CRITICAL: Always scroll to the bottom when the user sends a message.
		if (lastMessage?.role === 'user') {
			scrollToBottom();
			return; // Exit early
		}

		// For AI messages, only scroll if the user is already near the bottom.
		if (shouldAutoScrollRef.current) {
			scrollToBottom();
		}
	}, [activeComposerState?.messages, loading, scrollToBottom]);

	const state = useMemo(() => {
		if (!activeThread || !activeComposerState) return null;
		return activeThread.id === activeComposerState.threadId ? activeComposerState : composerStates.find(s => s.threadId === activeThread.id);
	}, [activeComposerState, activeThread, composerStates]);

	if (!state) return null;

	return (
		<ul
			ref={ulRef}
			className="flex-1 overflow-x-hidden overflow-y-auto list-none m-0 p-0 pr-2"
			style={{ scrollBehavior: 'auto' }} // Use 'auto' for programmatic scrolls
		>
			<ChatThread state={state} loading={loading} />
			{children}
			<div ref={bottomRef} style={{ height: '1px', width: '100%' }} />
		</ul>
	);
}

export default ChatThreadList;
