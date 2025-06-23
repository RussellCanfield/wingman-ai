import {
	type AiProviders,
	AiProvidersList,
	type ApiSettingsType,
	type AzureAISettingsType,
	type OllamaSettingsType,
} from "@shared/types/Settings";
import type { InitSettings } from "./App";
import { OllamaSettingsView } from "./OllamaSettingsView";
import { OpenAISettingsView } from "./OpenAISettingsView";
import { AnthropicSettingsView } from "./AnthropicSettingsView";
import { ProviderInfoView } from "./ProviderInfoView";
import { AzureAISettingsView } from "./AzureAISettingsView";
import { XAISettingsView } from './xAISettingsView';
import { OpenRouterSettingsView } from "./OpenRouterSettingsView";
import { GoogleSettingsView } from "./GoogleSettingsView";
import { HFSettingsView } from './HFSettingsView';
import { LMStudioSettingsView } from "./LMStudioSettingsView";

export type AiProviderProps = {
	settings: InitSettings;
	onProviderChanged: (provider: AiProviders) => void;
	onProviderSettingsChanged: (
		settings: OllamaSettingsType | ApiSettingsType | AzureAISettingsType
	) => void;
};

export const AiProvider = ({
	settings,
	onProviderChanged,
	onProviderSettingsChanged,
}: AiProviderProps) => {
	const { aiProvider, providerSettings } = settings;
	const { Ollama, HuggingFace, OpenAI, Anthropic, AzureAI, xAI, OpenRouter, Google, LMStudio } =
		providerSettings;

	const handleProviderChange = (e: any) => {
		onProviderChanged(e.target.value);
	};

	return (
		<div className="container mx-auto">
			<div className="mb-4">
				<label
					htmlFor="ai-provider"
					className="block mb-2 text-sm font-medium"
				>
					AI Provider:
				</label>
				<select
					id="ai-provider"
					value={aiProvider}
					onChange={handleProviderChange}
					className="w-full p-2 border bg-[var(--vscode-input-background)] border-[var(--vscode-editor-foreground)] rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
				>
					{AiProvidersList.map((ab) => (
						<option key={ab} value={ab}>
							{ab}
						</option>
					))}
				</select>
			</div>
			<hr className="my-4 border-t border-[var(--vscode-editor-foreground)]" />
			{aiProvider === "Ollama" && (
				//@ts-expect-error
				<OllamaSettingsView
					{...Ollama}
					onChange={onProviderSettingsChanged}
				/>
			)}
			{aiProvider === "Google" && (
				<GoogleSettingsView
					{...Google}
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
			{aiProvider === "AzureAI" && (
				//@ts-expect-error
				<AzureAISettingsView
					{...AzureAI}
					onChange={onProviderSettingsChanged}
				/>
			)}
			{aiProvider === "xAI" && (
				//@ts-expect-error
				<XAISettingsView
					{...xAI}
					onChange={onProviderSettingsChanged}
				/>
			)}
			{aiProvider === "OpenRouter" && (
				//@ts-expect-error
				<OpenRouterSettingsView
					{...OpenRouter}
					onChange={onProviderSettingsChanged}
				/>
			)}
			{aiProvider === "LMStudio" && (
				//@ts-expect-error
				<LMStudioSettingsView
					{...LMStudio}
					onChange={onProviderSettingsChanged}
				/>
			)}
			<ProviderInfoView {...settings} aiProvider={aiProvider} />
		</div>
	);
};
