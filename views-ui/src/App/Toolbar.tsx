import { VscClearAll } from "react-icons/vsc";
import { HiDatabase } from "react-icons/hi";
import { HiLightningBolt } from "react-icons/hi";
import { vscode } from "./utilities/vscode";
import { useSettingsContext } from "./context/settingsContext";
import { useComposerContext } from "./context/composerContext";
import { MdSettings } from "react-icons/md";

const viewName = {
	composer: "Wingman",
	index: "Index",
};

export default function Toolbar() {
	const {
		isLightTheme,
		view,
		setView,
	} = useSettingsContext();
	const { setComposerMessages } = useComposerContext();

	const buttonBaseClasses = "rounded transition-colors duration-300 p-2";
	const buttonActiveClasses = isLightTheme
		? "bg-gray-300 text-black"
		: "bg-gray-700 text-white";
	const buttonInactiveClasses = isLightTheme
		? "text-black hover:bg-gray-200"
		: "text-white hover:bg-gray-800";

	return (
		<div className="flex justify-between items-center gap-4">
			<h2 className="text-lg font-bold flex-auto">{viewName[view]}</h2>
			<button
				className={`${buttonBaseClasses} ${view === "composer"
					? buttonActiveClasses
					: buttonInactiveClasses
					}`}
				onClick={() => setView("composer")}
				title="Composer"
			>
				<HiLightningBolt size={24} />
			</button>
			<button
				className={`${buttonBaseClasses} ${view === "index"
					? buttonActiveClasses
					: buttonInactiveClasses
					}`}
				onClick={() => setView("index")}
				title="Index"
			>
				<HiDatabase size={24} />
			</button>
			<button
				className={`${buttonBaseClasses} ${buttonInactiveClasses}`}
				onClick={() => {
					vscode.postMessage({ command: 'openSettings' })
				}}
				title="Settings"
			>
				<MdSettings size={24} />
			</button>
			<button
				className={`${buttonBaseClasses} ${buttonInactiveClasses}`}
				onClick={() => {
					vscode.postMessage({
						command: "clear-chat-history",
					});
					setComposerMessages([]);
				}}
				title="Clear chat history"
			>
				<VscClearAll size={24} role="presentation" />
			</button>
		</div>
	);
}
