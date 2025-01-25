import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import {
	prism,
	vscDarkPlus,
} from "react-syntax-highlighter/dist/esm/styles/prism";
import { memo, PropsWithChildren } from "react";
import { FileMetadata } from "@shared/types/Message";
import { DiffViewCommand } from "@shared/types/v2/Composer";
import { FaCheckCircle } from "react-icons/fa";
import { vscode } from "./utilities/vscode";
import ReactDiffViewer, { DiffMethod } from "../Common/DiffView";
import { FaXmark } from "react-icons/fa6";

const CodeContainer = memo(({ children }: PropsWithChildren) => {
	return (
		<div className="relative">
			<div className="overflow-x-auto markdown-container">{children}</div>
		</div>
	);
});

export interface DiffProps {
	diff: DiffViewCommand;
}

export default function DiffView({ diff }: DiffProps) {
	const { file, isDarkTheme } = diff;

	const highlightSyntax = (str: string) => {
		return (
			<SyntaxHighlighter
				language={file.language || "typescript"}
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
				path: file.path!,
				code: file?.code,
			} satisfies FileMetadata,
		});
	};

	const rejectDiff = () => {
		vscode.postMessage({
			command: "reject-file-changes",
			value: {
				path: file?.path!,
				code: file?.code,
			} satisfies FileMetadata,
		});
	};

	return (
		<div className="fixed inset-0 bg-gray-900 flex flex-col">
			<div className="bg-gray-800 p-4 flex justify-between items-center z-10">
				<p className="text-white font-semibold truncate">{file.path}</p>
				<div className="flex gap-4">
					<button
						className="bg-red-500 hover:bg-red-600 text-white font-bold py-2 px-4 rounded inline-flex items-center transition duration-300 ease-in-out"
						title="Accept changes"
						onClick={() => rejectDiff()}
					>
						<FaXmark className="mr-2" />
						<span>Reject</span>
					</button>
					<button
						className="bg-green-500 hover:bg-green-600 text-white font-bold py-2 px-4 rounded inline-flex items-center transition duration-300 ease-in-out"
						title="Accept changes"
						onClick={() => acceptDiff()}
					>
						<FaCheckCircle className="mr-2" />
						<span>Accept</span>
					</button>
				</div>
			</div>
			<div className="flex-grow overflow-y-auto">
				<ReactDiffViewer
					oldValue={file.original}
					newValue={file.code}
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
