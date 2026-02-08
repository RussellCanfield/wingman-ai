import { createRoot } from "react-dom/client";
import { App } from "./App.js";
import "./styles.css";

document.body.classList.add("overlay-mode");

const root = document.getElementById("app");
if (!root) {
	throw new Error("Missing #app root");
}

createRoot(root).render(<App overlayMode />);
