import {
	VSCodeButton,
	VSCodeDivider,
	VSCodeDropdown,
	VSCodeOption,
} from "@vscode/webview-ui-toolkit/react";
import { useState } from "react";
import {
	AiProvidersList,
	defaultAnthropicSettings,
	defaultHfSettings,
	defaultOllamaSettings,
	defaultOpenAISettings,
} from "@shared/types/Settings";
import { InitSettings } from "./App";
import { ActionPanel, Container, DropDownContainer } from "./Config";
import { HFSettingsView } from "./HFSettingsView";
import { OllamaSettingsView } from "./OllamaSettingsView";
import { OpenAISettingsView } from "./OpenAISettingsView";
import { vscode } from "./utilities/vscode";
import { AnthropicSettingsView } from "./AnthropicSettingsView";
import { ProviderInfoView } from "./ProviderInfoView";

export const AiProvider = (settings: InitSettings) => {
	const { aiProvider, providerSettings, ollamaModels } = settings;
	const { Ollama, HuggingFace, OpenAI, Anthropic } = providerSettings;
	const [currentAiProvider, setAiProvider] = useState(aiProvider);
	const [ollamaSettings, setOllamaSettings] = useState(
		Ollama ?? defaultOllamaSettings
	);
	const [hfSettings, setHfSettings] = useState(
		HuggingFace ?? defaultHfSettings
	);
	const [openAISettings, setOpenAISettings] = useState(
		OpenAI ?? defaultOpenAISettings
	);
	const [anthropicSettings, setAnthropicSettings] = useState(
		Anthropic ?? defaultAnthropicSettings
	);
	const handleProviderChange = (e: any) => {
		setAiProvider(e.target.value);
	};

	const cancel = () => {
		setAiProvider(aiProvider);
		switch (currentAiProvider) {
			case "Ollama":
				setOllamaSettings(Ollama ?? defaultOllamaSettings);
				break;
			case "HuggingFace":
				setHfSettings(HuggingFace ?? defaultHfSettings);
				break;
			case "OpenAI":
				setOpenAISettings(OpenAI ?? defaultOpenAISettings);
				break;
			case "Anthropic":
				setAnthropicSettings(Anthropic ?? defaultAnthropicSettings);
				break;
		}
	};

	const reset = () => {
		switch (currentAiProvider) {
			case "Ollama":
				setOllamaSettings(defaultOllamaSettings);
				break;
			case "HuggingFace":
				setHfSettings(defaultHfSettings);
				break;
			case "OpenAI":
				setOpenAISettings(defaultOpenAISettings);
				break;
			case "Anthropic":
				setAnthropicSettings(defaultAnthropicSettings);
				break;
		}
	};

	const handleClick = () => {
		if (currentAiProvider === "Ollama") {
			vscode.postMessage({
				command: "updateAndSetOllama",
				value: ollamaSettings,
			});
			return;
		}

		if (currentAiProvider === "HuggingFace") {
			vscode.postMessage({
				command: "updateAndSetHF",
				value: hfSettings,
			});
			return;
		}

		if (currentAiProvider === "OpenAI") {
			vscode.postMessage({
				command: "updateAndSetOpenAI",
				value: openAISettings,
			});
			return;
		}

		if (currentAiProvider === "Anthropic") {
			vscode.postMessage({
				command: "updateAndSetAnthropic",
				value: anthropicSettings,
			});
			return;
		}
	};

	return (
		<Container>
			<DropDownContainer>
				<label htmlFor="ai-provider">AI Provider:</label>
				<VSCodeDropdown
					id="ai-provider"
					value={currentAiProvider}
					onChange={handleProviderChange}
					style={{ minWidth: "100%" }}
				>
					{AiProvidersList.map((ab) => (
						<VSCodeOption key={ab}>{ab}</VSCodeOption>
					))}
				</VSCodeDropdown>
			</DropDownContainer>
			<VSCodeDivider />
			{currentAiProvider === "Ollama" && (
				<OllamaSettingsView
					{...ollamaSettings}
					ollamaModels={ollamaModels}
					onChange={setOllamaSettings}
				/>
			)}
			{currentAiProvider === "HuggingFace" && (
				<HFSettingsView {...hfSettings} onChange={setHfSettings} />
			)}
			{currentAiProvider === "OpenAI" && (
				<OpenAISettingsView
					{...openAISettings}
					onChange={setOpenAISettings}
				/>
			)}
			{currentAiProvider === "Anthropic" && (
				<AnthropicSettingsView
					{...anthropicSettings}
					onChange={setAnthropicSettings}
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
			<ProviderInfoView {...settings} aiProvider={currentAiProvider} />
		</Container>
	);
};
