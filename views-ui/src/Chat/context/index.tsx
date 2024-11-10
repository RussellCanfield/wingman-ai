import { FC, PropsWithChildren, useEffect } from "react";
import { SettingsProvider } from "./settingsContext";
import { ChatProvider } from "./chatContext";
import { ComposerProvider } from "./composerContext";
import { vscode } from "../utilities/vscode";

export const RootProvider: FC<PropsWithChildren> = ({ children }) => {
	useEffect(() => {
		vscode.postMessage({ command: "ready" });
	}, []);
	
	return (
	  <SettingsProvider>
		<ChatProvider>
		  <ComposerProvider>
			{children}
		  </ComposerProvider>
		</ChatProvider>
	  </SettingsProvider>
	);
  };