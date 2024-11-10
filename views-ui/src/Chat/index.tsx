import { createRoot } from "react-dom/client";
import App from "./App";
import { RootProvider } from "./context";

const domNode = document.getElementById("root");
const root = createRoot(domNode!);
root.render(
	<RootProvider>
		<App />
	</RootProvider>
);
