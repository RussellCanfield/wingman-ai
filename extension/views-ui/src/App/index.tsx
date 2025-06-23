import { createRoot } from "react-dom/client";
import App from "./App";
import { RootProvider } from "./context";
import 'react-tooltip/dist/react-tooltip.css';

const domNode = document.getElementById("root");
if (domNode) {
	const root = createRoot(domNode);
	root.render(
		<RootProvider>
			<App />
		</RootProvider>
	);
} else {
	console.error("Failed to find the root element");
}
