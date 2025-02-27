import { AppMessage } from "@shared/types/Message";
import { useEffect, useState } from "react";
import "./App.css";
import { Thread, WorkspaceSettings } from "@shared/types/Settings";
import ThreadVisualization from "./ThreadVisualization";
import { vscode } from "./utilities/vscode";

export default function App() {
	const [threads, setThreads] = useState<Thread[] | undefined>();
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
			case "thread-data":
				const settings = value as WorkspaceSettings;
				setThreads(settings.threads);
				setActiveThreadId(settings.activeThreadId);
				break;
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