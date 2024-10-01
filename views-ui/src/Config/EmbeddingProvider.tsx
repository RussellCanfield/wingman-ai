import {
	VSCodeDivider,
	VSCodeDropdown,
	VSCodeOption,
} from "@vscode/webview-ui-toolkit/react";
import {
	EmbeddingProviders,
	EmbeddingProvidersList,
	OllamaEmbeddingSettingsType,
	OpenAIEmbeddingSettingsType,
} from "@shared/types/Settings";
import { InitSettings } from "./App";
import { Container, DropDownContainer } from "./Config";
import { OllamaEmbeddingSettingsView } from "./OllamaEmbeddingSettingsView";
import { OpenAIEmbeddingSettingsView } from "./OpenAIEmbeddingSettingsView";

export type EmbeddingProviderProps = {
	embeddingProvider: EmbeddingProviders;
	embeddingSettings: InitSettings["embeddingSettings"];
	onProviderChange: (provider: EmbeddingProviders) => void;
	onEmbeddingSettingsChange: (
		settings: OllamaEmbeddingSettingsType | OpenAIEmbeddingSettingsType
	) => void;
};

export const EmbeddingProvider = ({
	embeddingProvider,
	embeddingSettings,
	onProviderChange,
	onEmbeddingSettingsChange,
}: EmbeddingProviderProps) => {
	const handleProviderChange = (e: any) => {
		onProviderChange(e.target.value);
	};

	return (
		<Container>
			<p className="mb-4 text-xl">Embedding:</p>
			<DropDownContainer>
				<label htmlFor="embedding-provider">Embedding Provider:</label>
				<VSCodeDropdown
					id="embedding-provider"
					value={embeddingProvider}
					onChange={handleProviderChange}
					style={{ minWidth: "100%" }}
				>
					{EmbeddingProvidersList.map((ab) => (
						<VSCodeOption key={ab}>{ab}</VSCodeOption>
					))}
				</VSCodeDropdown>
			</DropDownContainer>
			<VSCodeDivider />
			{embeddingProvider === "Ollama" && (
				<OllamaEmbeddingSettingsView
					{...embeddingSettings.Ollama!}
					onChange={onEmbeddingSettingsChange}
				/>
			)}
			{embeddingProvider === "OpenAI" && (
				<OpenAIEmbeddingSettingsView
					{...embeddingSettings.OpenAI!}
					onChange={onEmbeddingSettingsChange}
				/>
			)}
		</Container>
	);
};
