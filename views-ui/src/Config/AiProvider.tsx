import {
	VSCodeDivider,
	VSCodeDropdown,
	VSCodeOption,
} from "@vscode/webview-ui-toolkit/react";
import {
	AiProviders,
	AiProvidersList,
	ApiSettingsType,
	OllamaSettingsType,
} from "@shared/types/Settings";
import { InitSettings } from "./App";
import { Container, DropDownContainer } from "./Config";
import { HFSettingsView } from "./HFSettingsView";
import { OllamaSettingsView } from "./OllamaSettingsView";
import { OpenAISettingsView } from "./OpenAISettingsView";
import { AnthropicSettingsView } from "./AnthropicSettingsView";
import { ProviderInfoView } from "./ProviderInfoView";

export type AiProviderProps = {
	settings: InitSettings;
	onProviderChanged: (provider: AiProviders) => void;
	onProviderSettingsChanged: (
		settings: OllamaSettingsType | ApiSettingsType
	) => void;
};

export const AiProvider = ({
	settings,
	onProviderChanged,
	onProviderSettingsChanged,
}: AiProviderProps) => {
	const { aiProvider, providerSettings, ollamaModels } = settings;
	const { Ollama, HuggingFace, OpenAI, Anthropic } = providerSettings;

	const handleProviderChange = (e: any) => {
		onProviderChanged(e.target.value);
	};

	return (
		<Container>
			<p className="mb-4 text-xl">AI Provider:</p>
			<DropDownContainer>
				<label htmlFor="ai-provider">AI Provider:</label>
				<VSCodeDropdown
					id="ai-provider"
					value={aiProvider}
					onChange={handleProviderChange}
					style={{ minWidth: "100%" }}
				>
					{AiProvidersList.map((ab) => (
						<VSCodeOption key={ab}>{ab}</VSCodeOption>
					))}
				</VSCodeDropdown>
			</DropDownContainer>
			<VSCodeDivider />
			{aiProvider === "Ollama" && (
				//@ts-expect-error
				<OllamaSettingsView
					{...Ollama}
					ollamaModels={ollamaModels}
					onChange={onProviderSettingsChanged}
				/>
			)}
			{aiProvider === "HuggingFace" && (
				//@ts-expect-error
				<HFSettingsView
					{...HuggingFace}
					onChange={onProviderSettingsChanged}
				/>
			)}
			{aiProvider === "OpenAI" && (
				//@ts-expect-error
				<OpenAISettingsView
					{...OpenAI}
					onChange={onProviderSettingsChanged}
				/>
			)}
			{aiProvider === "Anthropic" && (
				//@ts-expect-error
				<AnthropicSettingsView
					{...Anthropic}
					onChange={onProviderSettingsChanged}
				/>
			)}
			<ProviderInfoView {...settings} aiProvider={aiProvider} />
		</Container>
	);
};
