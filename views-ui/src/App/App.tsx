import Toolbar from "./Toolbar";
import { useEffect, useState } from "react";
import Compose from "./features/Compose";
import "./App.css";
import { useComposerContext } from "./context/composerContext";

const App = () => {
	const {
		initialized
	} = useComposerContext();
	const [isVisible, setIsVisible] = useState(false);

	useEffect(() => {
		setIsVisible(true);
	}, []);

	return (
		<main className={`h-full flex flex-col overflow-hidden text-base transition-opacity duration-300 ease-in-out ${isVisible ? 'opacity-100' : 'opacity-0'}`}>
			{initialized && (
				<>
					<Toolbar />
					<div className="border-b border-stone-500 mb-2" />
					<Compose />
				</>
			)}
			{!initialized && (
				<Compose />
			)}
		</main>
	);
};

export default App;