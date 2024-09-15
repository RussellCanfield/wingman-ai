import { VscClearAll } from "react-icons/vsc";
import { HiDatabase } from "react-icons/hi";
import { HiChatAlt } from "react-icons/hi";
import { HiLightningBolt } from "react-icons/hi";
import { useAppContext } from "./context";
import { vscode } from "./utilities/vscode";

export type View = "chat" | "code" | "index";

type ViewName = {
	[keyof in View]: string;
};

const viewName: ViewName = {
	chat: "Chat",
	code: "Compose",
	index: "Index",
};

export interface ToolbarProps {
	activeView: View;
	onSetActiveView: (view: View) => void;
}

export default function Toolbar({ activeView, onSetActiveView }: ToolbarProps) {
	const { isLightTheme, setMessages, setComposerMessages } = useAppContext();

	const buttonBaseClasses = "rounded transition-colors duration-300 p-2";
	const buttonActiveClasses = isLightTheme
		? "bg-gray-300 text-black"
		: "bg-gray-700 text-white";
	const buttonInactiveClasses = isLightTheme
		? "text-black hover:bg-gray-200"
		: "text-white hover:bg-gray-800";

	return (
		<div className="flex justify-between items-center gap-4">
			<h2
				className="text-lg font-bold flex-auto"
				onClick={() => vscode.postMessage({ command: "diff-view" })}
			>
				Wingman - {viewName[activeView]}
			</h2>
			<button
				className={`${buttonBaseClasses} ${
					activeView === "chat"
						? buttonActiveClasses
						: buttonInactiveClasses
				}`}
				onClick={() => onSetActiveView("chat")}
				title="Chat"
			>
				<HiChatAlt size={24} />
			</button>
			<button
				className={`${buttonBaseClasses} ${
					activeView === "code"
						? buttonActiveClasses
						: buttonInactiveClasses
				}`}
				onClick={() => onSetActiveView("code")}
				title="Code"
			>
				<HiLightningBolt size={24} />
			</button>
			<button
				className={`${buttonBaseClasses} ${
					activeView === "index"
						? buttonActiveClasses
						: buttonInactiveClasses
				}`}
				onClick={() => onSetActiveView("index")}
				title="Index"
			>
				<HiDatabase size={24} />
			</button>
			<button
				className={`${buttonBaseClasses} ${buttonInactiveClasses}`}
				onClick={() => {
					vscode.postMessage({
						command: "clear-chat-history",
					});
					setMessages([]);
					setComposerMessages([]);
				}}
				title="Clear chat history"
			>
				<VscClearAll size={24} role="presentation" />
			</button>
		</div>
	);
}
