import { VscClearAll } from "react-icons/vsc";
import { HiLightningBolt } from "react-icons/hi";
import { useSettingsContext, type View } from "./context/settingsContext";
import { useComposerContext } from "./context/composerContext";
import { MdSettings } from "react-icons/md";
import { vscode } from "../utilities/vscode";

type ViewNames = {
	[key in View]: string;
};

const viewName: ViewNames = {
	composer: "Wingman",
};

export default function Toolbar() {
	const {
		isLightTheme,
		view,
		setView,
	} = useSettingsContext();
	const { activeThread } = useComposerContext();
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
				type="button"
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
				type="button"
				className={`${buttonBaseClasses} ${buttonInactiveClasses}`}
				onClick={() => {
					vscode.postMessage({ command: 'openSettings' })
				}}
				title="Settings"
			>
				<MdSettings size={24} />
			</button>
			<button
				type="button"
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
