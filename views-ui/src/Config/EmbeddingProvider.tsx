import {
	type EmbeddingProviders,
	EmbeddingProvidersList,
	type EmbeddingSettingsType,
	Settings,
} from "@shared/types/Settings";
import type { InitSettings } from "./App";
import { OllamaSettingsView } from "./EmbeddingOllamaSettingsView";
import { OpenAISettingsView } from "./EmbeddingOpenAISettingsView";
import { AzureAISettingsView } from "./EmbeddingAzureAISettingsView";
import { VscSync } from "react-icons/vsc";
import { IndexedFilesProgress } from "./IndexedFilesProgress";
import { vscode } from "./utilities/vscode";

export type EmbeddingProviderProps = {
	settings: InitSettings;
	indexedFiles?: string[];
	onProviderChanged: (provider: EmbeddingProviders) => void;
	onProviderSettingsChanged: (
		settings: EmbeddingSettingsType
	) => void;
};

export const EmbeddingProvider = ({
	settings,
	indexedFiles,
	onProviderChanged,
	onProviderSettingsChanged,
}: EmbeddingProviderProps) => {
	const { embeddingProvider, embeddingSettings, providerSettings, ollamaModels } = settings;
	const { Ollama, OpenAI, AzureAI } =
		embeddingSettings;

	const handleProviderChange = (e: any) => {
		onProviderChanged(e.target.value);
	};

	const handleChangeInput = (e: any) => {
		const field = e.target.getAttribute("data-name");
		const value = e.target.type === "checkbox" ? e.target.checked : e.target.value;
		//@ts-expect-error
		const clone: EmbeddingSettingsType = { ...embeddingSettings };
		//@ts-expect-error
		clone.General[field] = value;
		onProviderSettingsChanged(clone);
	};

	const copyProviderSettings = () => {
		const updatedSettings = { ...providerSettings[embeddingProvider] } as EmbeddingSettingsType;
		//@ts-expect-error
		// biome-ignore lint/performance/noDelete: <explanation>
		delete updatedSettings.chatModel;
		//@ts-expect-error
		// biome-ignore lint/performance/noDelete: <explanation>
		delete updatedSettings.codeModel;
		onProviderSettingsChanged(updatedSettings);
	}

	return (
		<div className="container mx-auto">
			<div className="mb-4">
				<label
					htmlFor="ai-provider"
					className="block mb-2 text-sm font-medium"
				>
					AI Provider:
				</label>
				<div className="flex gap-4">
					<select
						id="ai-provider"
						value={embeddingProvider}
						onChange={handleProviderChange}
						className="w-full p-2 border bg-[var(--vscode-input-background)] border-[var(--vscode-editor-foreground)] rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
					>
						{EmbeddingProvidersList.map((ab) => (
							<option key={ab} value={ab}>
								{ab}
							</option>
						))}
					</select>
					<button
						type="button"
						onClick={() => copyProviderSettings()}
						className="px-3 py-2 bg-[var(--vscode-button-background)] text-[var(--vscode-button-foreground)] rounded-md hover:bg-[var(--vscode-button-hoverBackground)] focus:outline-none focus:ring-2 focus:ring-[var(--vscode-focusBorder)]"
						title="Copy Settings"
					>
						<VscSync size={16} />
					</button>
				</div>
			</div>
			<div className="flex flex-col items-start gap-4">
				<div className="flex items-center gap-2">
					<input
						id="enabled"
						type="checkbox"
						className="px-3 py-2 bg-[var(--vscode-input-background)] text-[var(--vscode-input-foreground)] border border-[var(--vscode-input-border)] rounded-md focus:outline-none focus:ring-2 focus:ring-[var(--vscode-focusBorder)]"
						onChange={handleChangeInput}
						checked={embeddingSettings.General.enabled}
						data-name="enabled"
						title="Enable Embedding"
					/>
					<label
						htmlFor="enabled"
						className="text-sm font-medium text-[var(--vscode-foreground)]"
					>
						Enabled
					</label>
				</div>
				<div className="flex flex-col">
					<label
						htmlFor="globPattern"
						className="mb-1 text-sm font-medium text-[var(--vscode-foreground)]"
					>
						File Inclusion Glob:
					</label>
					<input
						id="globPattern"
						type="text"
						className="px-3 py-2 bg-[var(--vscode-input-background)] text-[var(--vscode-input-foreground)] border border-[var(--vscode-input-border)] rounded-md focus:outline-none focus:ring-2 focus:ring-[var(--vscode-focusBorder)]"
						onChange={handleChangeInput}
						value={embeddingSettings.General.globPattern}
						data-name="globPattern"
						title="File Inclusion Pattern"
					/>
					<p className="mt-1 text-xs text-[var(--vscode-descriptionForeground)]">
						Filters files for indexing
					</p>
				</div>
				<div className="flex flex-col">
					<IndexedFilesProgress indexedFiles={indexedFiles} />
				</div>
			</div>
			<hr className="my-4 border-t border-[var(--vscode-editor-foreground)]" />
			{embeddingProvider === "Ollama" && (
				//@ts-expect-error
				<OllamaSettingsView
					{...Ollama}
					ollamaModels={ollamaModels}
					onChange={onProviderSettingsChanged}
				/>
			)}
			{embeddingProvider === "OpenAI" && (
				//@ts-expect-error
				<OpenAISettingsView
					{...OpenAI}
					onChange={onProviderSettingsChanged}
				/>
			)}
			{embeddingProvider === "AzureAI" && (
				//@ts-expect-error
				<AzureAISettingsView
					{...AzureAI}
					onChange={onProviderSettingsChanged}
				/>
			)}
		</div>
	);
};
