import { type FC, type PropsWithChildren, useEffect } from "react";
import { SettingsProvider } from "./settingsContext";
import { ComposerProvider } from "./composerContext";
import { vscode } from "../utilities/vscode";

export const RootProvider: FC<PropsWithChildren> = ({ children }) => {
	useEffect(() => {
		vscode.postMessage({ command: "ready" });
	}, []);

	return (
		<SettingsProvider>
			<ComposerProvider>
				{children}
			</ComposerProvider>
		</SettingsProvider>
	);
};