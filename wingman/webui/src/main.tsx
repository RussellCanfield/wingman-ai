import React from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import "reactflow/dist/style.css";
import { App } from "./App";
import "./styles.css";

const container = document.getElementById("root");

if (!container) {
	throw new Error("Missing #root element");
}

createRoot(container).render(
	<React.StrictMode>
		<BrowserRouter>
			<App />
		</BrowserRouter>
	</React.StrictMode>,
);
