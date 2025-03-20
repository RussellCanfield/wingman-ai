import type { DiffViewCommand } from "@shared/types/Composer";
import type { AppMessage } from "@shared/types/Message";
import { useEffect, useState } from "react";
import DiffView from "./DiffView";
import "./App.css";

export default function App() {
	const [diff, setDiff] = useState<DiffViewCommand>();

	useEffect(() => {
		window.addEventListener("message", handleResponse);

		return () => {
			window.removeEventListener("message", handleResponse);
		};
	}, []);

	const handleResponse = (event: MessageEvent<AppMessage>) => {
		const { data } = event;
		const { command, value } = data;

		switch (command) {
			case "diff-file":
				setDiff(value as DiffViewCommand);
				break;
		}
	};

	if (!diff) return null;

	return <DiffView diff={diff} />;
}
