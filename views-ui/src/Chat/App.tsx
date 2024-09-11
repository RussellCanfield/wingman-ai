import Toolbar, { View } from "./Toolbar";
import { AppProvider } from "./context";
import Chat from "./features/Chat";
import { useMemo, useState } from "react";
import Indexer from "./features/Indexer";
import Compose from "./features/Compose";
import "./App.css";

const App = () => {
	const [activeView, setActiveView] = useState<View>("chat");

	const activeComponent = useMemo(() => {
		switch (activeView) {
			case "chat":
				return <Chat />;
			case "index":
				return <Indexer />;
			case "code":
				return <Compose />;
			default:
				return null;
		}
	}, [activeView]);

	return (
		<AppProvider>
			<main className="h-full flex flex-col flex-auto">
				<Toolbar
					onSetActiveView={setActiveView}
					activeView={activeView}
				/>
				{activeComponent}
			</main>
		</AppProvider>
	);
};

export default App;
