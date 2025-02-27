import Toolbar from "./Toolbar";
import { useMemo, useEffect, useState } from "react";
import Compose from "./features/Compose";
import "./App.css";
import { useSettingsContext } from "./context/settingsContext";

const App = () => {
	const { view } = useSettingsContext();
	const [isVisible, setIsVisible] = useState(false);

	useEffect(() => {
		setIsVisible(true);
	}, []);

	const activeComponent = useMemo(() => {
		switch (view) {
			case "composer":
				return <Compose />;
			default:
				return null;
		}
	}, [view]);

	return (
		<main className={`h-full flex flex-col overflow-hidden text-base transition-opacity duration-300 ease-in-out ${isVisible ? 'opacity-100' : 'opacity-0'}`}>
			<Toolbar />
			<div className="border-b border-stone-500 mb-2" />
			{activeComponent}
		</main>
	);
};

export default App;