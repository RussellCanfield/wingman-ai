import {
	PropsWithChildren,
	useEffect,
	useMemo,
	useRef,
	useState,
} from "react";
import {
	BaseMessage,
	CodeReviewMessage,
	CommitMessage,
	Message,
} from "@shared/types/Message";
import ChatEntry from "./ChatEntry";
import CodeReviewSummary from "./CodeReviewSummary";

function ChatResponseList({
	children,
	messages,
}: PropsWithChildren & { messages: BaseMessage[] }) {
	const ulRef = useRef<HTMLUListElement>(null);
	const ref = useRef<HTMLDivElement>(null);
	const [userHasScrolled, setUserHasScrolled] = useState(false);

	// Scroll to the latest message
	const scrollToBottom = () => {
		if (ref.current && !userHasScrolled) {
			ref.current.scrollIntoView({ behavior: "smooth", block: "nearest" });
		}
	};

	// Observe user scrolling behavior to toggle auto-scroll
	useEffect(() => {
		const ulElement = ulRef.current;
		if (!ulElement) return;

		const observer = new IntersectionObserver(
			(entries) => {
				// If the "bottom" ref is not visible, assume user has scrolled up
				if (entries[0].isIntersecting) {
					setUserHasScrolled(false); // Reset scroll state if user is at the bottom
				} else {
					setUserHasScrolled(true);
				}
			},
			{
				root: ulElement,
				threshold: 0.9, // Trigger when 90% of the bottom element is visible
			}
		);

		if (ref.current) observer.observe(ref.current);

		return () => observer.disconnect();
	}, []);

	// Scroll whenever messages update, unless the user has scrolled manually
	useEffect(() => {
		if (!userHasScrolled) {
			// Ensure scrolling occurs only after the DOM is updated
			requestAnimationFrame(() => {
				scrollToBottom();
			});
		}
	}, [messages]);

	// Generate chat history
	const chatHistory = useMemo(() => {
		return messages.map((message, index) => {
			switch (message.type) {
				case "code-review":
					return (
						<CodeReviewSummary
							key={`${message.type}-${index}`}
							message={message as CodeReviewMessage}
						/>
					);
				case "commit-msg":
					return (
						<ChatEntry
							key={`${message.type}-${index}`}
							from="assistant"
							message={(message as CommitMessage).message}
						/>
					);
				default:
					const { from, message: body, context } = message as Message;
					return (
						<ChatEntry
							key={`${message.type}-${index}`}
							from={from}
							message={body}
							context={context}
						/>
					);
			}
		});
	}, [messages]);

	return (
		<ul
			ref={ulRef}
			className="flex-1 overflow-x-hidden overflow-y-auto list-none m-0 p-0 pr-2"
		>
			{chatHistory}
			{children}
			<div ref={ref}></div>
		</ul>
	);
}

export { ChatResponseList };