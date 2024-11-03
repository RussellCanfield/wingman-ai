import { DiffViewCommand } from "@shared/types/Composer";
import { AppMessage } from "@shared/types/Message";
import { useEffect, useState } from "react";
import DiffView from "./DiffView";

const SkeletonLoader = () => {
	return (
		<div className="bg-gray-900 rounded-lg overflow-hidden shadow-lg animate-pulse">
			<div className="bg-gray-800 p-4 flex justify-between items-center">
				<div className="h-6 bg-gray-700 rounded w-3/4"></div>
				<div className="h-10 bg-gray-700 rounded w-20"></div>
			</div>
			<div className="p-4">
				<div className="h-4 bg-gray-700 rounded mb-2"></div>
				<div className="h-4 bg-gray-700 rounded mb-2"></div>
				<div className="h-4 bg-gray-700 rounded mb-2"></div>
				<div className="h-4 bg-gray-700 rounded mb-2"></div>
				<div className="h-4 bg-gray-700 rounded mb-2"></div>
			</div>
		</div>
	);
};

export default function App() {
	const [diff, setDiff] = useState<DiffViewCommand>();
	const [diffs, setDiffs] = useState<DiffViewCommand[]>([]);

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
				setDiffs(value as DiffViewCommand[]);
				break;
		}
	};

	if (!diff && diffs.length === 0) {
		return <SkeletonLoader />;
	}

	if (diff) {
		return <DiffView diff={diff} />;
	}
}
