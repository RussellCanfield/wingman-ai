import { createRoot } from "react-dom/client";
import App from "./App";
import { AppProvider } from "./context";

const domNode = document.getElementById("root");
const root = createRoot(domNode!);
root.render(
	<AppProvider>
		<App />
	</AppProvider>
);
