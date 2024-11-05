import {
	AppMessage,
	BaseMessage,
	Message,
	ChatMessages,
	CodeReviewMessage,
	ChatMessage,
} from "@shared/types/Message";
import React, {
	createContext,
	PropsWithChildren,
	useContext,
	useEffect,
	useState,
} from "react";
import { vscode } from "../utilities/vscode";
import { ComposerMessage } from "@shared/types/Composer";
import { AppState } from "@shared/types/Settings";

export type View = "chat" | "composer" | "index";

interface AppContextType {
	messages: ChatMessages;
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
	setIndexFilter: React.Dispatch<React.SetStateAction<string>>;
	exclusionFilter?: string;
	setExclusionFilter: React.Dispatch<React.SetStateAction<string>>;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export const useAppContext = () => {
	const context = useContext(AppContext);
	if (!context)
		throw new Error("useAppContext must be used within an AppProvider");
	return context;
};

export const AppProvider = ({ children }: PropsWithChildren) => {
	const [messages, setMessages] = useState<ChatMessages>([]);
	const [composerMessages, setComposerMessages] = useState<ComposerMessage[]>(
		[]
	);
	const [theme, setTheme] = useState<Number>(1);
	const [appState, setAppState] = useState<AppState | null>();
	const [view, setView] = useState<View>("chat");
	const [indexFilter, setIndexFilter] = useState<string>(
		"apps/**/*.{js,jsx,ts,tsx}"
	);
	const [exclusionFilter, setExclusionFilter] = useState<string>("");

	useEffect(() => {
		vscode.postMessage({ command: "ready" });

		const handleResponse = (event: MessageEvent<AppMessage>) => {
			const { command, value } = event.data;

			switch (command) {
				case "init":
					const storedAppState = value as AppState;
					setAppState(storedAppState);
					if (storedAppState?.settings.chatMessages) {
						setMessages(storedAppState.settings.chatMessages);
					}
					if (storedAppState?.settings.indexerSettings) {
						const { indexFilter, exclusionFilter } =
							storedAppState?.settings.indexerSettings;
						setIndexFilter(indexFilter);
						setExclusionFilter(exclusionFilter || "");
					}
					setTheme(storedAppState?.theme ?? 1);
					break;
				case "switchView":
					setView(value as View);
					break;
				case "setTheme":
					setTheme(value as number);
					break;
			}
		};

		window.addEventListener("message", handleResponse);
		return () => window.removeEventListener("message", handleResponse);
	}, []);

	useEffect(() => {
		if (!appState) return;

		const newState: AppState = {
			...appState,
			settings: {
				chatMessages: messages,
				indexerSettings: {
					indexFilter,
					exclusionFilter,
				},
			},
		};

		vscode.postMessage({
			command: "state-update",
			value: newState,
		});
	}, [appState, messages, indexFilter, exclusionFilter]);

	const addMessage = <T extends ChatMessage | CodeReviewMessage>(
		message: T
	) => {
		if ("message" in message) {
			setMessages((prev) => [...prev, message as ChatMessage]);
		} else {
			setMessages((prev) => [...prev, message as CodeReviewMessage]);
		}
	};

	const clearMessages = () => {
		setMessages([]);
	};

	const isLightTheme = theme === 1;

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
				indexFilter,
				setIndexFilter,
				exclusionFilter,
				setExclusionFilter,
			}}
		>
			{children}
		</AppContext.Provider>
	);
};
