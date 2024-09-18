import ReactDiffViewer, { DiffMethod } from "react-diff-viewer-continued";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import {
	prism,
	vscDarkPlus,
} from "react-syntax-highlighter/dist/esm/styles/prism";
import "./App.css";
import { memo, PropsWithChildren, useEffect, useState } from "react";
import { AppMessage } from "@shared/types/Message";
import { DiffViewCommand } from "@shared/types/Composer";
import { FaCheckCircle } from "react-icons/fa";
import { vscode } from "./utilities/vscode";

const CodeContainer = memo(({ children }: PropsWithChildren) => {
	return (
		<div className="relative">
			<div className="overflow-x-auto markdown-container">{children}</div>
		</div>
	);
});

export default function DiffView() {
	const [diff, setDiff] = useState<DiffViewCommand>();

	const isDarkTheme = !diff || diff?.theme !== 1;

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
				console.log("diff", value);
				setDiff(value as DiffViewCommand);
				break;
		}
	};

	const highlightSyntax = (str: string) => {
		return (
			<SyntaxHighlighter
				language="typescript"
				style={isDarkTheme ? vscDarkPlus : prism}
				PreTag={CodeContainer}
			>
				{str}
			</SyntaxHighlighter>
		);
	};

	const newStyles = {
		variables: {
			dark: {
				diffViewerBackground: "rgb(30, 30, 30)",
				gutterBackground: "rgb(30, 30, 30)",
				diffViewerTitleBackground: "rgb(30, 30, 30)",
				gitterBackground: "rgb(30, 30, 30)",
				highlightBackground: "rgb(30, 30, 30)",
				highlightGutterBackground: "rgb(30, 30, 30)",
				addedBackground: "#2ea04326",
				addedGutterBackground: "#2ea04326",
				wordAddedBackground: "transparent",
			},
		},
		line: {
			padding: "2px 2px",
		},
	};

	const acceptDiff = () => {
		vscode.postMessage({
			command: "accept-file-changes",
			value: {
				file: diff?.file,
				code: diff?.diff,
			},
		});
	};

	if (!diff) {
		return <SkeletonLoader />;
	}

	return (
		<div className="bg-gray-900 rounded-lg shadow-lg">
			<div className="bg-gray-800 p-4 flex justify-between items-center">
				<p className="text-white font-semibold truncate">{diff.file}</p>
				<button
					className="bg-green-500 hover:bg-green-600 text-white font-bold py-2 px-4 rounded inline-flex items-center transition duration-300 ease-in-out"
					title="Accept changes"
					onClick={() => acceptDiff()}
				>
					<FaCheckCircle className="mr-2" />
					<span>Accept</span>
				</button>
			</div>
			<div>
				<ReactDiffViewer
					oldValue={diff.original}
					newValue={diff.diff}
					styles={newStyles}
					compareMethod={DiffMethod.TRIMMED_LINES}
					splitView={false}
					useDarkTheme={isDarkTheme}
					showDiffOnly={false}
					renderContent={highlightSyntax}
				/>
			</div>
		</div>
	);
}

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
