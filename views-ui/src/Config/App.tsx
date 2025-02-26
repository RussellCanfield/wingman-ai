import { useEffect, useState } from "react";
import { AppMessage } from "@shared/types/Message";
import {
	AiProviders,
	ApiSettingsType,
	AzureAIEmbeddingSettingsType,
	AzureAISettingsType,
	EmbeddingProviders,
	InteractionSettings,
	OllamaEmbeddingSettingsType,
	OllamaSettingsType,
	OpenAIEmbeddingSettingsType,
	Settings,
	ValidationSettings,
} from "@shared/types/Settings";
import { AiProvider } from "./AiProvider";
import { InteractionSettingsConfig } from "./InteractionSettingsConfig";
import { vscode } from "./utilities/vscode";
import "./App.css";
import { EmbeddingProvider } from "./EmbeddingProvider";
import { ValidationView } from "./ValidationView";

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
		aiProviderSettings:
			| OllamaSettingsType
			| ApiSettingsType
			| AzureAISettingsType
	) => {
		const currentProviderSettings = settings.providerSettings;

		const updatedProviderSettings = { ...currentProviderSettings };

		console.log(updatedProviderSettings, aiProviderSettings);

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
		} else if (settings.aiProvider === "AzureAI") {
			updatedProviderSettings.AzureAI =
				aiProviderSettings as AzureAISettingsType;
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
		} else if (settings.embeddingProvider === "OpenAI") {
			existingEmbeddingSettings.OpenAI =
				embeddingSettings as OpenAIEmbeddingSettingsType;
		} else {
			existingEmbeddingSettings.AzureAI =
				embeddingSettings as AzureAIEmbeddingSettingsType;
		}

		setSettings((s) => ({
			...s!,
			embeddingSettings: existingEmbeddingSettings,
		}));
	};

	const onValidationSettingsChanged = (settings: ValidationSettings) => {
		setSettings((s) => ({
			...s!,
			validationSettings: settings,
		}));
	};

	const saveSettings = () => {
		vscode.postMessage({
			command: "saveSettings",
			value: settings,
		});
	};

	return (
		<div className="flex flex-col p-4">
			<h2 className="text-xl font-semibold mb-4">Wingman Settings</h2>
			<p>
				Visit{" "}
				<a
					href="https://wingman.squadron-ai.com/"
					target="_blank"
					rel="noopener noreferrer"
					className="text-blue-500 hover:text-blue-600 underline"
				>
					our documentation
				</a>{" "}
				for more information about Wingman settings and configuration
				options.
			</p>
			<div className="mb-6 flex justify-end">
				<button
					type="button"
					onClick={saveSettings}
					className="bg-blue-600 hover:bg-blue-700 text-white  py-2 px-4 rounded-md shadow-md transition duration-300 ease-in-out text-sm font-semibold"
				>
					Save
				</button>
			</div>
			<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
				<section className="bg-[var(--vscode-editorWidget-border)] rounded-lg shadow-md  hover:shadow-lg transition duration-300 ease-in-out p-6">
					<h2 className="text-xl font-semibold mb-4">AI Provider</h2>
					<AiProvider
						settings={settings}
						onProviderChanged={onAiProviderChanged}
						onProviderSettingsChanged={onAiProviderSettingsChanged}
					/>
				</section>
				<section className="bg-[var(--vscode-editorWidget-border)] rounded-lg shadow-md hover:shadow-lg transition duration-300 ease-in-out p-6">
					<h2 className="text-xl font-semibold mb-4">
						Interaction Settings
					</h2>
					<InteractionSettingsConfig
						interactions={settings.interactionSettings}
						onChange={onInteractionSettingsChanged}
					/>
				</section>
				<section className="bg-[var(--vscode-editorWidget-border)] rounded-lg shadow-md hover:shadow-lg transition duration-300 ease-in-out p-6">
					<h2 className="text-xl font-semibold mb-4">
						Embedding Provider
					</h2>
					<EmbeddingProvider
						{...settings}
						onProviderChange={onEmbeddingProviderChanged}
						onEmbeddingSettingsChange={onEmbeddingSettingsChanged}
					/>
				</section>
				<section className="bg-[var(--vscode-editorWidget-border)] rounded-lg shadow-md hover:shadow-lg transition duration-300 ease-in-out p-6">
					<h2 className="text-xl font-semibold mb-4">Validation</h2>
					<ValidationView
						validationSettings={settings.validationSettings}
						onValidationChanged={onValidationSettingsChanged}
					/>
				</section>
			</div>
		</div>
	);
};
