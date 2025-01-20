import { PropsWithChildren, useEffect, useMemo, useRef, useState } from "react";
import ChatEntry from "./ChatEntry";
import { ComposerMessage } from "@shared/types/v2/Composer";

function ChatResponseList({
	children,
	messages,
}: PropsWithChildren & { messages: ComposerMessage[] }) {
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
		return messages.map(({ from, message, files, dependencies, image }, index) => (
			<ChatEntry
				key={index}
				from={from}
				loading={false}
				message={message}
				files={files}
				dependencies={dependencies}
				image={image}
				isCurrent={index === message.length - 1}
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
			<div ref={ref}></div>
		</ul>
	);
}

export default ChatResponseList;
