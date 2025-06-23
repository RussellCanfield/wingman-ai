import type { AppMessage } from "@shared/types/Message";
import { useEffect, useState } from "react";
import "./App.css";
import ThreadVisualization from "./ThreadVisualization";
import { vscode } from "./utilities/vscode";
import type { ComposerState, ComposerThread } from "@shared/types/Composer";

export default function App() {
	const [threads, setThreads] = useState<ComposerThread[] | undefined>();
	const [activeThreadId, setActiveThreadId] = useState<string | undefined>();

	useEffect(() => {
		window.addEventListener("message", handleResponse);

		// Request thread data when component mounts
		vscode.postMessage({
			command: "get-threads"
		});

		return () => {
			window.removeEventListener("message", handleResponse);
		};
	}, []);

	const handleResponse = (event: MessageEvent<AppMessage>) => {
		const { data } = event;
		const { command, value } = data;

		switch (command) {
			case "thread-data": {
				const { states, activeThreadId } = value as { states: ComposerState[], activeThreadId: string };
				const threads = states.map(s => ({
					id: s.threadId,
					title: s.title,
					createdAt: s.createdAt,
					parentThreadId: s.parentThreadId
				} satisfies ComposerThread))
				setThreads(threads);
				setActiveThreadId(activeThreadId);
				break;
			}
		}
	};

	const handleThreadSelect = (threadId: string) => {
		vscode.postMessage({
			command: "switch-thread",
			value: threadId
		});
		setActiveThreadId(threadId);
	};

	if (!threads) {
		return null;
	}

	return (
		<div className="app-container">
			<ThreadVisualization
				threads={threads}
				activeThreadId={activeThreadId}
				onThreadSelect={handleThreadSelect}
			/>
		</div>
	);
}