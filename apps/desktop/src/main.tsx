import { createRoot } from "react-dom/client";
import { HashRouter } from "react-router-dom";
import { App } from "./App.js";
import "./styles.css";

const root = document.getElementById("app");
if (!root) {
	throw new Error("Missing #app root");
}

createRoot(root).render(
	<HashRouter>
		<App overlayMode={false} />
	</HashRouter>,
);
