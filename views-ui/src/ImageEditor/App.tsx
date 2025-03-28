import type { AppMessage } from "@shared/types/Message";
import { useEffect, useState } from "react";
import "./App.css";
import { vscode } from "./utilities/vscode";
import type { ComposerState, ComposerThread } from "@shared/types/Composer";

export default function App() {

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
				break;
			}
		}
	};

	return (
		<div className="app-container">

		</div>
	);
}