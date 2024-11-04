import ReactDiffViewer, { DiffMethod } from "react-diff-viewer-continued";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import {
	prism,
	vscDarkPlus,
} from "react-syntax-highlighter/dist/esm/styles/prism";
import "./App.css";
import { memo, PropsWithChildren } from "react";
import { FileMetadata, FileReviewDetails } from "@shared/types/Message";
import { FaCheckCircle } from "react-icons/fa";
import { vscode } from "./utilities/vscode";

const CodeContainer = memo(({ children }: PropsWithChildren) => {
	return (
		<div className="relative">
			<div className="overflow-x-auto markdown-container">{children}</div>
		</div>
	);
});

export interface DiffProps {
	reviewDetails: FileReviewDetails;
	isDarkTheme: boolean;
}

export default function DiffViewWithComments({
	reviewDetails,
	isDarkTheme,
}: DiffProps) {
	const { diff, original, current } = reviewDetails;

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

	return (
		<div className="bg-gray-900 flex flex-col">
			<div className="flex-grow overflow-y-auto">
				<ReactDiffViewer
					oldValue={original}
					newValue={current}
					styles={newStyles}
					compareMethod={DiffMethod.CHARS}
					splitView={false}
					useDarkTheme={isDarkTheme}
					showDiffOnly={false}
					renderContent={highlightSyntax}
				/>
			</div>
		</div>
	);
}
