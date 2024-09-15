import { AppMessage, ChatMessage } from "@shared/types/Message";
import React, {
	createContext,
	PropsWithChildren,
	useContext,
	useEffect,
	useState,
	useSyncExternalStore,
} from "react";
import { localMemState } from "../utilities/localMemState";
import { vscode } from "../utilities/vscode";
import { ComposerMessage } from "@shared/types/Composer";

interface AppContextType {
	messages: ChatMessage[];
	setMessages: React.Dispatch<React.SetStateAction<ChatMessage[]>>;
	composerMessages: ComposerMessage[];
	setComposerMessages: React.Dispatch<
		React.SetStateAction<ComposerMessage[]>
	>;
	isLightTheme: boolean;
	indexFilter: string;
}

interface AppState {
	chatHistory: Record<string, ChatMessage[]>;
	isLightTheme: boolean;
	indexFilter: string;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export const useAppContext = () => {
	const context = useContext(AppContext);
	if (!context) {
		throw new Error("useAppContext must be used within an AppProvider");
	}
	return context;
};

export const AppProvider = ({ children }: PropsWithChildren) => {
	const lm = useSyncExternalStore(
		localMemState.subscribe,
		localMemState.getSnapshot
	);
	const [messages, setMessages] = useState<ChatMessage[]>([]);
	const [composerMessages, setComposerMessages] = useState<ComposerMessage[]>(
		[]
	);
	const [activeWorkspace, setWorkspaceFolder] = useState<string>("");
	const [currentAppState, setAppState] = useState<AppState | null>(null);

	useEffect(() => {
		vscode.postMessage({
			command: "ready",
		});
	}, []);

	useEffect(() => {
		const handleResponse = (event: MessageEvent<AppMessage>) => {
			const { data } = event;
			const { command, value } = data;

			switch (command) {
				case "init":
					const { workspaceFolder, theme } = value as {
						workspaceFolder: string;
						theme: number;
					};
					setWorkspaceFolder(workspaceFolder);
					localMemState.setState("theme", theme);

					const appState = vscode.getState() as AppState | null;

					setAppState(appState);

					if (
						appState?.chatHistory &&
						appState.chatHistory[workspaceFolder]
					) {
						setMessages(appState.chatHistory[workspaceFolder]);
					}
					break;
				case "setTheme":
					const newTheme = value as number;
					localMemState.setState("theme", newTheme);
					break;
			}
		};

		const setMessages = (messages: ChatMessage[]) => {
			const chatMessages =
				messages.length === 0 ? [] : messages.concat(messages);

			//@ts-expect-error
			currentAppState[activeWorkspace] = chatMessages;
			vscode.setState(currentAppState);
		};

		window.addEventListener("message", handleResponse);

		return () => {
			window.removeEventListener("message", handleResponse);
		};
	}, []);

	const theme = lm["theme"] as number;
	const isLightTheme = theme === 1;

	return (
		<AppContext.Provider
			value={{
				messages,
				setMessages,
				composerMessages,
				setComposerMessages,
				isLightTheme,
				indexFilter: currentAppState?.indexFilter || "",
			}}
		>
			{children}
		</AppContext.Provider>
	);
};
