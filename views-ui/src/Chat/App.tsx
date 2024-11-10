import Toolbar from "./Toolbar";
import Chat from "./features/Chat";
import { useMemo } from "react";
import Indexer from "./features/Indexer";
import Compose from "./features/Compose";
import "./App.css";
import { useSettingsContext } from "./context/settingsContext";

const App = () => {
	const { view } = useSettingsContext();

	const activeComponent = useMemo(() => {
		switch (view) {
			case "chat":
				return <Chat />;
			case "index":
				return <Indexer />;
			case "composer":
				return <Compose />;
			default:
				return null;
		}
	}, [view]);

	return (
		<main className="h-full flex flex-col overflow-hidden text-base">
			<Toolbar />
			<div className="border-b border-stone-500 mb-2"></div>
			{activeComponent}
		</main>
	);
};

export default App;
