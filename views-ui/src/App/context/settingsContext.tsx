import type React from "react";
import { createContext, useContext, useState, useEffect, type FC, type PropsWithChildren } from "react"
import type { AppMessage } from "@shared/types/Message";
import type { AppState } from "@shared/types/Settings";

export type View = "composer";

interface SettingsContextType {
  view: View;
  setView: React.Dispatch<React.SetStateAction<View>>;
  isLightTheme: boolean;
}

const SettingsContext = createContext<SettingsContextType | undefined>(undefined);

export const useSettingsContext = () => {
  const context = useContext(SettingsContext);
  if (!context) throw new Error("useSettingsContext must be used within SettingsProvider");
  return context;
};

export const SettingsProvider: FC<PropsWithChildren> = ({ children }) => {
  const [theme, setTheme] = useState(1);
  const [view, setView] = useState<View>("composer");
  const [appState, setAppState] = useState<AppState | null>();

  useEffect(() => {
    const handleResponse = (event: MessageEvent<AppMessage>) => {
      const { command, value } = event.data;
      switch (command) {
        case "init": {
          const storedAppState = value as AppState;

          setAppState(storedAppState);
          setTheme(storedAppState?.theme ?? 1);
          break;
        }
        case "setTheme":
          setTheme(value as number);
          break;
        case "switchView":
          setView(value as View);
          break;
      }
    };

    window.addEventListener("message", handleResponse);
    return () => window.removeEventListener("message", handleResponse);
  }, []);

  return (
    <SettingsContext.Provider
      value={{
        view,
        setView,
        isLightTheme: theme === 1,
      }}
    >
      {children}
    </SettingsContext.Provider>
  );
};