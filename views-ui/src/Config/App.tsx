import { useEffect, useState } from "react";
import { AppMessage } from "@shared/types/Message";
import {
	AiProviders,
	ApiSettingsType,
	EmbeddingProviders,
	InteractionSettings,
	OllamaEmbeddingSettingsType,
	OllamaSettingsType,
	OpenAIEmbeddingSettingsType,
	Settings,
} from "@shared/types/Settings";
import { AiProvider } from "./AiProvider";
import { InteractionSettingsConfig } from "./InteractionSettingsConfig";
import { vscode } from "./utilities/vscode";
import "./App.css";
import { EmbeddingProvider } from "./EmbeddingProvider";

export type InitSettings = Settings & { ollamaModels: string[] };

export const App = () => {
	const [loading, setLoading] = useState(true);
	const [settings, setSettings] = useState<InitSettings | null>(null);

	useEffect(() => {
		vscode.postMessage({
			command: "init",
		});
		window.addEventListener("message", handleResponse);
		return () => {
			window.removeEventListener("message", handleResponse);
		};
	}, []);

	const handleResponse = (event: MessageEvent<AppMessage>) => {
		const { command, value } = event.data;

		switch (command) {
			case "init":
				setSettings(JSON.parse(value as string) as InitSettings);
				setLoading(false);
				return;
		}
	};

	if (loading) {
		return <h3>Loading ...</h3>;
	}

	if (!settings) {
		return <h3>Error loading settings</h3>;
	}

	const onInteractionSettingsChanged = (settings: InteractionSettings) => {
		setSettings((prevSettings) => ({
			...prevSettings!,
			interactionSettings: settings,
		}));
	};

	const onAiProviderChanged = (provider: AiProviders) => {
		setSettings((s) => ({
			...s!,
			aiProvider: provider,
		}));
	};

	const onAiProviderSettingsChanged = (
		aiProviderSettings: OllamaSettingsType | ApiSettingsType
	) => {
		const currentProviderSettings = settings.providerSettings;

		const updatedProviderSettings = { ...currentProviderSettings };

		if (settings.aiProvider === "Ollama") {
			updatedProviderSettings.Ollama =
				aiProviderSettings as OllamaSettingsType;
		} else if (settings.aiProvider === "OpenAI") {
			updatedProviderSettings.OpenAI =
				aiProviderSettings as ApiSettingsType;
		} else if (settings.aiProvider === "Anthropic") {
			updatedProviderSettings.Anthropic =
				aiProviderSettings as ApiSettingsType;
		} else if (settings.aiProvider === "HuggingFace") {
			updatedProviderSettings.HuggingFace =
				aiProviderSettings as ApiSettingsType;
		}

		setSettings((s) => ({
			...s!,
			providerSettings: updatedProviderSettings,
		}));
	};

	const onEmbeddingProviderChanged = (provider: EmbeddingProviders) => {
		setSettings((s) => ({
			...s!,
			embeddingProvider: provider,
		}));
	};

	const onEmbeddingSettingsChanged = (
		embeddingSettings:
			| OllamaEmbeddingSettingsType
			| OpenAIEmbeddingSettingsType
	) => {
		const existingEmbeddingSettings = settings.embeddingSettings;
		if (settings.embeddingProvider === "Ollama") {
			existingEmbeddingSettings.Ollama =
				embeddingSettings as OllamaEmbeddingSettingsType;
		} else {
			existingEmbeddingSettings.OpenAI =
				embeddingSettings as OpenAIEmbeddingSettingsType;
		}

		setSettings((s) => ({
			...s!,
			embeddingSettings: existingEmbeddingSettings,
		}));
	};

	const saveSettings = () => {
		vscode.postMessage({
			command: "saveSettings",
			value: settings,
		});
	};

	return (
		<div className="flex flex-col">
			<div className="mt-4 mb-4 flex justify-end p-4">
				<button
					type="button"
					onClick={saveSettings}
					className="bg-blue-500 text-gray-100 p-2 rounded border-solid text-md min-w-20 font-bold"
				>
					Save
				</button>
			</div>
			<div className="flex flex-row flex-nowrap gap-2 items-stretch p-4">
				<section className="p-4 rounded-lg border border-gray-500">
					<AiProvider
						settings={settings}
						onProviderChanged={onAiProviderChanged}
						onProviderSettingsChanged={onAiProviderSettingsChanged}
					/>
				</section>
				<section className="p-4 rounded-lg border border-gray-500">
					<InteractionSettingsConfig
						interactions={settings.interactionSettings}
						onChange={onInteractionSettingsChanged}
					/>
				</section>
				<section className="p-4 rounded-lg border border-gray-500">
					<EmbeddingProvider
						{...settings}
						onProviderChange={onEmbeddingProviderChanged}
						onEmbeddingSettingsChange={onEmbeddingSettingsChanged}
					/>
				</section>
			</div>
		</div>
	);
};
