import { DiffViewCommand } from "@shared/types/v2/Composer";
import { AppMessage, CodeReviewCommand } from "@shared/types/Message";
import { useEffect, useState } from "react";
import DiffView from "./DiffView";
import "./App.css";
import CodeReviewFileByFile from "./CodeReviewFileByFile";

export default function App() {
	const [diff, setDiff] = useState<DiffViewCommand>();
	const [review, setCodeReview] = useState<CodeReviewCommand | undefined>();

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
			case "code-review":
				setCodeReview(value as CodeReviewCommand);
				break;
		}
	};

	if (diff) {
		return <DiffView diff={diff} />;
	} else if (review) {
		return (
			<CodeReviewFileByFile
				review={review.review}
				isDarkTheme={review.isDarkTheme}
			/>
		);
	}

	return null;
}
