import { useEffect, useState } from "react";
import { AppMessage } from "@shared/types/Message";
import { Settings } from "@shared/types/Settings";
import { AiProvider } from "./AiProvider";
import { InteractionSettings } from "./InteractionSettings";
import { vscode } from "./utilities/vscode";
import { ProviderInfoView } from "./ProviderInfoView";
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

	return (
		<div className="flex flex-row flex-nowrap gap-2 items-stretch">
			<section className="p-4 rounded-lg border border-gray-300 w-[350px]">
				<AiProvider {...settings} />
			</section>
			<section className="p-4 rounded-lg border border-gray-300 w-[350px]">
				<InteractionSettings {...settings.interactionSettings} />
			</section>
			<section className="p-4 rounded-lg border border-gray-300 w-[350px]">
				<EmbeddingProvider {...settings} />
			</section>
		</div>
	);
};
