import { useAppContext } from "../../context";
import { vscode } from "../../utilities/vscode";
import { AppMessage } from "@shared/types/Message";
import { IndexFilter } from "@shared/types/Settings";
import { useEffect, useState } from "react";
import { Loader } from "../../Loader";

type IndexStats = {
	exists: boolean;
	processing: boolean;
	files: string[];
};

let interval: NodeJS.Timeout;

export default function Indexer() {
	const { indexFilter, exclusionFilter: savedExclusionFilter } =
		useAppContext();
	const [index, setIndex] = useState<IndexStats>({
		exists: false,
		processing: false,
		files: [],
	});
	const [filter, setFilter] = useState(
		indexFilter || "apps/**/*.{js,jsx,ts,tsx}"
	);
	const [exclusionFilter, setExclusionFilter] =
		useState(savedExclusionFilter);

	useEffect(() => {
		vscode.postMessage({
			command: "check-index",
		});
		interval = setInterval(() => {
			vscode.postMessage({
				command: "check-index",
			});
		}, 3000);

		return () => {
			clearInterval(interval);
		};
	}, []);

	useEffect(() => {
		window.addEventListener("message", handleResponse);

		return () => {
			window.removeEventListener("message", handleResponse);
		};
	}, []);

	const handleResponse = (event: MessageEvent<AppMessage>) => {
		const { data } = event;
		const { command } = data;

		switch (command) {
			case "index-status":
				const indexStats = data.value as IndexStats;
				if (
					indexStats.exists !== index.exists ||
					indexStats.processing !== index.processing ||
					indexStats.files.length !== index.files.length
				) {
					setIndex(indexStats);
				}
		}
	};

	const buildIndex = () => {
		vscode.postMessage({
			command: "build-index",
			value: {
				filter,
				exclusionFilter,
			} satisfies IndexFilter,
		});
		setIndex((idx) => ({ ...idx, processing: true }));
	};

	const deleteIndex = () => {
		vscode.postMessage({
			command: "delete-index",
		});
	};

	return (
		<div className="flex flex-col h-full">
			<div className="space-y-4 mt-4 overflow-y-auto">
				<p className="text-lg font-bold">
					Status:{" "}
					{index.exists
						? index.processing
							? "Processing"
							: "Ready"
						: "Not Found"}
				</p>
				<p className="text-lg">
					The indexer will breakdown your codebase to use as context
					in chat, or interactively with the code composer. It will
					scan your workspace for any filters meeting the filter
					criteria below. By default, Wingman will include your
					'.gitignore' file in your exclusion filter.
				</p>
				{!index.exists && !index.processing && (
					<section className="flex flex-col gap-4">
						<label>Inclusion Filter:</label>
						<input
							type="text"
							className="border border-gray-300 rounded px-2 py-1"
							value={filter || ""}
							onChange={(e) => setFilter(e.target.value)}
						/>
						<label>Exclusion Filter: </label>
						<input
							type="text"
							className="border border-gray-300 rounded px-2 py-1"
							value={exclusionFilter || ""}
							onChange={(e) => setExclusionFilter(e.target.value)}
						/>
						<button
							className="bg-blue-500 text-white px-4 py-2 rounded disabled:opacity-50"
							disabled={index.processing || !filter}
							onClick={() => buildIndex()}
						>
							Build Index
						</button>
					</section>
				)}
				{index.processing && (
					<p className="flex items-center">
						<Loader />{" "}
						<span className="ml-2">Building Index...</span>
					</p>
				)}
				{index.exists && !index.processing && (
					<>
						<button
							className="bg-red-600 text-white px-4 py-2 rounded"
							onClick={() => deleteIndex()}
						>
							Delete Index
						</button>
						<div>
							<button
								className="bg-blue-500 text-white px-4 py-2 rounded disabled:opacity-50"
								disabled={index.processing || !filter}
								onClick={() => buildIndex()}
							>
								Build Index
							</button>
						</div>
						<div className="mt-4">
							<p className="text-lg font-bold">Indexed Files:</p>
						</div>
					</>
				)}
			</div>
			{index.exists && !index.processing && (
				<div className="flex-shrink-0 overflow-y-auto max-h-[60vh] mt-4">
					<ul className="space-y-1">
						{index.files.map((f, index) => (
							<li key={index}>{f}</li>
						))}
					</ul>
				</div>
			)}
		</div>
	);
}
