import {
	VSCodeButton,
	VSCodeDivider,
	VSCodeDropdown,
	VSCodeOption,
} from "@vscode/webview-ui-toolkit/react";
import { useState } from "react";
import {
	defaultOllamaEmbeddingSettings,
	defaultOpenAIEmbeddingSettings,
	EmbeddingProvidersList,
} from "@shared/types/Settings";
import { InitSettings } from "./App";
import { ActionPanel, Container, DropDownContainer } from "./Config.styles";
import { vscode } from "./utilities/vscode";
import { OllamaEmbeddingSettingsView } from "./OllamaEmbeddingSettingsView";
import { OpenAIEmbeddingSettingsView } from "./OpenAIEmbeddingSettingsView";

export const EmbeddingProvider = ({
	embeddingProvider,
	ollamaEmeddingSettings,
	openaiEmbeddingSettings,
}: InitSettings) => {
	const [currentAiProvider, setAiProvider] = useState(embeddingProvider);
	const [ollamaSettings, setOllamaSettings] = useState(
		ollamaEmeddingSettings ?? defaultOllamaEmbeddingSettings
	);
	const [openAISettings, setOpenAISettings] = useState(
		openaiEmbeddingSettings ?? defaultOpenAIEmbeddingSettings
	);
	const handleProviderChange = (e: any) => {
		setAiProvider(e.target.value);
	};

	const cancel = () => {
		setAiProvider(embeddingProvider);
		switch (currentAiProvider) {
			case "Ollama":
				setOllamaSettings(
					ollamaEmeddingSettings ?? defaultOllamaEmbeddingSettings
				);
				break;
			case "OpenAI":
				setOpenAISettings(
					openaiEmbeddingSettings ?? defaultOpenAIEmbeddingSettings
				);
				break;
		}
	};

	const reset = () => {
		switch (currentAiProvider) {
			case "Ollama":
				setOllamaSettings(defaultOllamaEmbeddingSettings);
				break;
			case "OpenAI":
				setOpenAISettings(defaultOpenAIEmbeddingSettings);
				break;
		}
	};

	const handleClick = () => {
		if (currentAiProvider === "Ollama") {
			vscode.postMessage({
				command: "updateAndSetOllamaEmbeddings",
				value: ollamaSettings,
			});
			return;
		}

		if (currentAiProvider === "OpenAI") {
			vscode.postMessage({
				command: "updateAndSetOpenAIEmbeddings",
				value: openAISettings,
			});
			return;
		}
	};

	return (
		<Container>
			<DropDownContainer>
				<label htmlFor="embedding-provider">Embedding Provider:</label>
				<VSCodeDropdown
					id="embedding-provider"
					value={currentAiProvider}
					onChange={handleProviderChange}
					style={{ minWidth: "100%" }}
				>
					{EmbeddingProvidersList.map((ab) => (
						<VSCodeOption key={ab}>{ab}</VSCodeOption>
					))}
				</VSCodeDropdown>
			</DropDownContainer>
			<VSCodeDivider />
			{currentAiProvider === "Ollama" && (
				<OllamaEmbeddingSettingsView
					{...ollamaSettings}
					onChange={setOllamaSettings}
				/>
			)}
			{currentAiProvider === "OpenAI" && (
				<OpenAIEmbeddingSettingsView
					{...openAISettings}
					onChange={setOpenAISettings}
				/>
			)}
			<ActionPanel>
				<VSCodeButton onClick={handleClick}>Save</VSCodeButton>
				<VSCodeButton appearance="secondary" onClick={cancel}>
					Cancel
				</VSCodeButton>
				<VSCodeButton appearance="secondary" onClick={reset}>
					Reset
				</VSCodeButton>
			</ActionPanel>
		</Container>
	);
};
