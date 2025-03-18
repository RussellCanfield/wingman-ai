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
	}, [activeComposerState, loading, scrollToBottom]);

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