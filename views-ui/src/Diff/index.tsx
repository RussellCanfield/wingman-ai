import { createRoot } from "react-dom/client";
import DiffView from "./DiffView";

const domNode = document.getElementById("root");
const root = createRoot(domNode!);
root.render(<DiffView />);
