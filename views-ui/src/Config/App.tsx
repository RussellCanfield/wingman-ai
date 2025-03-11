import { useCallback, useEffect, useState } from "react";
import type { AppMessage } from "@shared/types/Message";
import type {
	AiProviders,
	ApiSettingsType,
	AzureAISettingsType,
	InteractionSettings,
	OllamaSettingsType,
	Settings,
	AgentSettings,
	xAISettingsType,
	EmbeddingProviders,
	EmbeddingSettingsType,
} from "@shared/types/Settings";
import { AiProvider } from "./AiProvider";
import { InteractionSettingsConfig } from "./InteractionSettingsConfig";
import { vscode } from "./utilities/vscode";
import "./App.css";
import { AgentFeaturesView } from "./AgentFeaturesView";
import type { MCPToolConfig } from "@shared/types/Settings";
import { MCPConfiguration } from "./McpTools";
import { EmbeddingProvider } from "./EmbeddingProvider";

export type InitSettings = Settings & {
	ollamaModels: string[];
};

export const App = () => {
	const [loading, setLoading] = useState(true);
	const [settings, setSettings] = useState<InitSettings | null>(null);
	const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved">("idle");
	const [isLightTheme, setIsLightTheme] = useState(false);

	useEffect(() => {
		vscode.postMessage({
			command: "init",
		});

		window.addEventListener("message", handleResponse);
		return () => {
			window.removeEventListener("message", handleResponse);
		};
	}, []);

	const saveSettings = (updatedSettings: Settings) => {
		setSaveStatus("saving");
		vscode.postMessage({
			command: "saveSettings",
			value: updatedSettings,
		});
	};

	const handleResponse = (event: MessageEvent<AppMessage>) => {
		const { command, value } = event.data;

		switch (command) {
			case "init": {
				const settings = value as { settings: InitSettings, theme: number };
				setSettings(settings.settings);
				setIsLightTheme(settings.theme === 1 || settings.theme === 4)
				setLoading(false);
				break;
			}
			case "settingsSaved":
				setSaveStatus("saved");
				setTimeout(() => setSaveStatus("idle"), 2000);
				break;
			case "tool-verified": {
				const config = value as MCPToolConfig;
				setSettings(prevSettings => {
					if (!prevSettings) return null;

					const updatedMcpTools = [...(prevSettings.mcpTools || [])];
					const toolIndex = updatedMcpTools.findIndex(t => t.name === config.name);

					if (toolIndex !== -1) {
						updatedMcpTools[toolIndex] = {
							...updatedMcpTools[toolIndex],
							verified: config.verified,
							tools: config.tools
						};
					}

					const settings: InitSettings = {
						...prevSettings,
						mcpTools: updatedMcpTools
					};

					saveSettings(settings);

					//node /Users/russellcanfield/Projects/mcp/webflow-mcp-server/dist/index.js
					return settings;
				});
				break;
			}
		}
	};

	if (loading) {
		return (
			<div className="flex items-center justify-center h-screen">
				<div className="animate-pulse flex flex-col items-center">
					<div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mb-4" />
					<h3 className="text-lg font-medium text-[var(--vscode-foreground)]">Loading settings...</h3>
				</div>
			</div>
		);
	}

	if (!settings) {
		return (
			<div className="flex items-center justify-center h-screen">
				<div className="bg-red-100 border-l-4 border-red-500 text-red-700 p-4 rounded-md shadow-md">
					<h3 className="font-bold">Error loading settings</h3>
					<p>Unable to load configuration. Please try refreshing the page.</p>
				</div>
			</div>
		);
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

	const onEmbeddingAiProviderChanged = (provider: EmbeddingProviders) => {
		setSettings((s) => ({
			...s!,
			embeddingProvider: provider,
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
		} else if (settings.aiProvider === "xAI") {
			updatedProviderSettings.xAI =
				aiProviderSettings as xAISettingsType;
		}

		setSettings((s) => ({
			...s!,
			providerSettings: updatedProviderSettings,
		}));
	};

	const onEmbeddingAiProviderSettingsChanged = (
		aiProviderSettings: EmbeddingSettingsType
	) => {
		const currentProviderSettings = settings.embeddingSettings;
		const updatedProviderSettings = { ...currentProviderSettings };

		if (settings.embeddingProvider === "Ollama") {
			updatedProviderSettings.Ollama =
				aiProviderSettings as Settings["embeddingSettings"]["Ollama"];
		} else if (settings.embeddingProvider === "OpenAI") {
			updatedProviderSettings.OpenAI =
				aiProviderSettings as Settings["embeddingSettings"]["OpenAI"];
		} else if (settings.embeddingProvider === "AzureAI") {
			updatedProviderSettings.AzureAI =
				aiProviderSettings as Settings["embeddingSettings"]["AzureAI"];
		}

		setSettings((s) => ({
			...s!,
			embeddingSettings: updatedProviderSettings,
		}));
	};

	const onValidationSettingsChanged = (settings: AgentSettings) => {
		setSettings((s) => ({
			...s!,
			agentSettings: settings,
		}));
	};

	const onMCPToolsChanged = (mcpTools: MCPToolConfig[]) => {
		setSettings((s) => ({
			...s!,
			mcpTools,
		}));
	};

	const cardClass = `
    relative flex flex-col p-6 rounded-xl
    ${isLightTheme
			? 'bg-white shadow-[0_2px_4px_rgba(0,0,0,0.1),0_8px_16px_rgba(0,0,0,0.1)] hover:shadow-[0_4px_8px_rgba(0,0,0,0.15),0_12px_24px_rgba(0,0,0,0.15)]'
			: 'bg-[#1e1e1e] shadow-[0_2px_4px_rgba(0,0,0,0.2),0_8px_16px_rgba(0,0,0,0.2)] hover:shadow-[0_4px_8px_rgba(0,0,0,0.25),0_12px_24px_rgba(0,0,0,0.25)]'
		}
    transition-all duration-300 ease-in-out
    border border-[var(--vscode-editorWidget-border)]
  `;

	const buttonClass = `
    ${saveStatus === "saving"
			? "bg-blue-500 cursor-wait"
			: saveStatus === "saved"
				? "bg-green-600 hover:bg-green-700"
				: "bg-blue-600 hover:bg-blue-700"
		}
    text-white py-2 px-6 rounded-md shadow-md 
    transition duration-300 ease-in-out 
    text-sm font-semibold flex items-center gap-2
  `;

	return (
		<div className="flex flex-col p-6 max-w-7xl mx-auto">
			<div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
				<div>
					<h1 className="text-2xl font-bold mb-2 text-[var(--vscode-foreground)]">
						Wingman Settings
					</h1>
					<p className="text-[var(--vscode-descriptionForeground)]">
						Configure your AI assistant to match your workflow. Visit{" "}
						<a
							href="https://wingman.squadron-ai.com/"
							target="_blank"
							rel="noopener noreferrer"
							className="text-blue-500 hover:text-blue-600 underline"
						>
							our documentation
						</a>{" "}
						for more information about configuration options.
					</p>

					<div className="mt-4 p-4 rounded-lg border-l-4 border-green-300 bg-green-600 transition-colors duration-300">
						<div className="flex items-start gap-2">
							{/* biome-ignore lint/a11y/noSvgWithoutTitle: <explanation> */}
							<svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 border-green-600 mt-0.5 flex-shrink-0" viewBox="0 0 20 20" fill="currentColor">
								<path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
							</svg>
							<div>
								<h3 className="font-semibold text-base text-gray-100">Remember!</h3>
								<p className="text-gray-100 text-sm">
									You can create custom rules similar to other editors, create ".wingmanrules" in your project root to customize AI behavior.{" "}
									<a
										href="https://github.com/PatrickJS/awesome-cursorrules"
										target="_blank"
										rel="noopener noreferrer"
										className="text-white font-medium underline"
									>
										Check out some examples.
									</a>
								</p>
							</div>
						</div>
					</div>
				</div>
			</div>
			<div className="flex flex-col md:flex-row justify-end items-end md:items-center mb-8 gap-4">
				<button
					type="button"
					onClick={() => saveSettings(settings)}
					disabled={saveStatus === "saving"}
					className={buttonClass}
				>
					{saveStatus === "saving" ? (
						<>
							{/* biome-ignore lint/a11y/noSvgWithoutTitle: <explanation> */}
							<svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
								<circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
								<path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
							</svg>
							Saving...
						</>
					) : saveStatus === "saved" ? (
						<>
							{/* biome-ignore lint/a11y/noSvgWithoutTitle: <explanation> */}
							<svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
								<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
							</svg>
							Saved!
						</>
					) : (
						"Save Settings"
					)}
				</button>
			</div>
			<div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
				<section className={cardClass}>
					<div className="absolute top-0 right-0 bg-blue-600 w-2 h-2 rounded-full m-2 transform scale-0 group-hover:scale-100 transition-transform" />
					<h2 className="text-lg font-semibold mb-4 pb-2 border-b border-[var(--vscode-editorWidget-border)]">
						AI Provider
					</h2>
					<AiProvider
						settings={settings}
						onProviderChanged={onAiProviderChanged}
						onProviderSettingsChanged={onAiProviderSettingsChanged}
					/>
				</section>

				<section className={cardClass}>
					<div className="absolute top-0 right-0 bg-green-600 w-2 h-2 rounded-full m-2 transform scale-0 group-hover:scale-100 transition-transform" />
					<h2 className="text-lg font-semibold mb-4 pb-2 border-b border-[var(--vscode-editorWidget-border)]">
						Interaction Settings
					</h2>
					<InteractionSettingsConfig
						interactions={settings.interactionSettings}
						onChange={onInteractionSettingsChanged}
					/>
				</section>

				<section className={cardClass}>
					<div className="absolute top-0 right-0 bg-purple-600 w-2 h-2 rounded-full m-2 transform scale-0 group-hover:scale-100 transition-transform" />
					<h2 className="text-lg font-semibold mb-4 pb-2 border-b border-[var(--vscode-editorWidget-border)]">
						Agent Features
					</h2>
					<AgentFeaturesView
						validationSettings={settings.agentSettings}
						onValidationChanged={onValidationSettingsChanged}
					/>
					<MCPConfiguration
						mcpTools={settings.mcpTools || []}
						onChange={onMCPToolsChanged}
					/>
				</section>

				<section className={`${cardClass} flex-2`}>
					<div className="absolute top-0 right-0 bg-green-600 w-2 h-2 rounded-full m-2 transform scale-0 group-hover:scale-100 transition-transform" />
					<h2 className="text-lg font-semibold mb-4 pb-2 border-b border-[var(--vscode-editorWidget-border)]">
						Embeddings Provider
					</h2>
					<EmbeddingProvider
						settings={settings}
						onProviderChanged={onEmbeddingAiProviderChanged}
						onProviderSettingsChanged={onEmbeddingAiProviderSettingsChanged}
					/>
				</section>
			</div>
		</div>
	);
};