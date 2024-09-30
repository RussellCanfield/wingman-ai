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

export type View = "chat" | "composer" | "index";

interface AppContextType {
	messages: ChatMessage[];
	pushMessage: (message: ChatMessage) => void;
	clearMessages: () => void;
	composerMessages: ComposerMessage[];
	setComposerMessages: React.Dispatch<
		React.SetStateAction<ComposerMessage[]>
	>;
	view: View;
	setView: React.Dispatch<React.SetStateAction<View>>;
	isLightTheme: boolean;
	indexFilter: string;
	exclusionFilter?: string;
}

interface AppState {
	chatHistory: Record<string, ChatMessage[]>;
	isLightTheme: boolean;
	indexFilter: string;
	exclusionFilter?: string;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export const useAppContext = () => {
	const context = useContext(AppContext);
	if (!context)
		throw new Error("useAppContext must be used within an AppProvider");
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
	const [appState, setAppState] = useState<AppState | null>(null);
	const [view, setView] = useState<View>("chat");

	useEffect(() => {
		vscode.postMessage({ command: "ready" });

		const handleResponse = (event: MessageEvent<AppMessage>) => {
			const { command, value } = event.data;

			switch (command) {
				case "init":
					const { workspaceFolder, theme } = value as {
						workspaceFolder: string;
						theme: number;
					};
					setWorkspaceFolder(workspaceFolder);
					localMemState.setState("theme", theme);
					const storedAppState = vscode.getState() as AppState | null;
					setAppState(storedAppState);
					if (storedAppState?.chatHistory?.[workspaceFolder]) {
						setMessages(
							storedAppState.chatHistory[workspaceFolder]
						);
					}
					break;
				case "switchView":
					setView(value as View);
					break;
				case "setTheme":
					localMemState.setState("theme", value as number);
					break;
			}
		};

		window.addEventListener("message", handleResponse);
		return () => window.removeEventListener("message", handleResponse);
	}, []);

	useEffect(() => {
		if (!appState) return;

		vscode.setState(appState);
	}, [appState]);

	useEffect(() => {
		const storedAppState = vscode.getState() as AppState | null;
		if (storedAppState) {
			setAppState(storedAppState);
			if (storedAppState.chatHistory && activeWorkspace) {
				setMessages(storedAppState.chatHistory[activeWorkspace] || []);
			}
		}
	}, [activeWorkspace]);

	const addMessage = (chatMessage: ChatMessage) => {
		const newMessages = [...messages, chatMessage];
		setMessages((msg) => [...msg, chatMessage]);
		setAppState((prevState) => ({
			isLightTheme: prevState?.isLightTheme || false,
			indexFilter: prevState?.indexFilter || "",
			exclusionFilter: prevState?.exclusionFilter || undefined,
			chatHistory: {
				...prevState?.chatHistory,
				[activeWorkspace]: (
					prevState?.chatHistory[activeWorkspace] || []
				).concat([chatMessage]),
			},
		}));
	};

	const clearMessages = () => {
		setMessages([]);
		setAppState((prevState) => ({
			isLightTheme: prevState?.isLightTheme || false,
			indexFilter: prevState?.indexFilter || "",
			exclusionFilter: prevState?.exclusionFilter || undefined,
			chatHistory: {
				...prevState?.chatHistory,
				[activeWorkspace]: [],
			},
		}));
	};

	const isLightTheme = lm["theme"] === 1;

	return (
		<AppContext.Provider
			value={{
				messages,
				pushMessage: addMessage,
				composerMessages,
				clearMessages,
				setComposerMessages,
				view,
				setView,
				isLightTheme,
				indexFilter: appState?.indexFilter || "",
				exclusionFilter: appState?.exclusionFilter,
			}}
		>
			{children}
		</AppContext.Provider>
	);
};
