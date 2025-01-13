import React, { createContext, useContext, useState, useEffect, FC, PropsWithChildren } from "react";
import { AppMessage } from "@shared/types/Message";
import { AppState } from "@shared/types/Settings";
import { vscode } from "../utilities/vscode";

export type View = "chat" | "composer" | "index";

export type IndexStats = {
  exists: boolean;
  processing: boolean;
  files: string[];
};

interface SettingsContextType {
  view: View;
  setView: React.Dispatch<React.SetStateAction<View>>;
  isLightTheme: boolean;
  indexFilter: string;
  setIndexFilter: React.Dispatch<React.SetStateAction<string>>;
  exclusionFilter?: string;
  setExclusionFilter: React.Dispatch<React.SetStateAction<string>>;
  totalFileCount: number;
  indexStats: IndexStats;
  setIndex: React.Dispatch<React.SetStateAction<IndexStats>>;
}

const SettingsContext = createContext<SettingsContextType | undefined>(undefined);

export const useSettingsContext = () => {
  const context = useContext(SettingsContext);
  if (!context) throw new Error("useSettingsContext must be used within SettingsProvider");
  return context;
};

export const SettingsProvider: FC<PropsWithChildren> = ({ children }) => {
  const [theme, setTheme] = useState<Number>(1);
  const [view, setView] = useState<View>("chat");
  const [appState, setAppState] = useState<AppState | null>();
  const [indexFilter, setIndexFilter] = useState<string>("src/**/*.{js,jsx,ts,tsx}");
  const [exclusionFilter, setExclusionFilter] = useState<string>("");
  const [index, setIndex] = useState<IndexStats>({
    exists: false,
    processing: false,
    files: [],
  });

  useEffect(() => {
    const handleResponse = (event: MessageEvent<AppMessage>) => {
      const { command, value } = event.data;
      console.log(value);
      switch (command) {
        case "init":
          const storedAppState = value as AppState;

          setAppState(storedAppState);
          if (storedAppState?.settings.indexerSettings) {
            const { indexFilter, exclusionFilter } =
              storedAppState?.settings.indexerSettings;
            setIndexFilter(indexFilter);
            setExclusionFilter(exclusionFilter || "");
          }
          setTheme(storedAppState?.theme ?? 1);
          break;
        case "setTheme":
          setTheme(value as number);
          break;
        case "switchView":
          setView(value as View);
          break;
        case "file-count-update":
          setAppState(prev => ({
            ...prev!,
            totalFiles: (value as AppState).totalFiles
          }));
          break;
        case "index-status":
          setIndex(value as IndexStats);
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
        ...appState.settings,
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
  }, [appState, indexFilter, exclusionFilter]);

  return (
    <SettingsContext.Provider
      value={{
        view,
        setView,
        isLightTheme: theme === 1,
        indexFilter,
        setIndexFilter,
        exclusionFilter,
        setExclusionFilter,
        totalFileCount: appState?.totalFiles ?? 0,
        indexStats: index,
        setIndex
      }}
    >
      {children}
    </SettingsContext.Provider>
  );
};