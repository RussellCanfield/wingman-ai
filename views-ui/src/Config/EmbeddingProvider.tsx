import {
	EmbeddingProviders,
	EmbeddingProvidersList,
	OllamaEmbeddingSettingsType,
	OpenAIEmbeddingSettingsType,
} from "@shared/types/Settings";
import { InitSettings } from "./App";
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
		<div className="container mx-auto p-4">
			<div className="mb-4">
				<label htmlFor="embedding-provider" className="block mb-2">
					Embedding Provider:
				</label>
				<select
					id="embedding-provider"
					className="w-full min-w-[200px] p-2 border rounded focus:outline-none focus:ring-2 focus:ring-[var(--vscode-focusBorder)] bg-[var(--vscode-input-background)] border-[var(--vscode-editor-foreground)]"
					title="Embedding Provider"
					data-name="codeCompletionEnabled"
					onChange={handleProviderChange}
					value={embeddingProvider}
				>
					{EmbeddingProvidersList.map((ab) => (
						<option key={ab}>{ab}</option>
					))}
				</select>
			</div>
			<hr className="my-4 border-t border-[var(--vscode-editor-foreground)]" />
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
		</div>
	);
};
