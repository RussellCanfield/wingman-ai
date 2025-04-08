import { VscRefresh } from "react-icons/vsc";
import type { InitSettings } from "./App";
import { vscode } from "./utilities/vscode";
import { useEffect, useState } from "react";
import type { AppMessage } from "@shared/types/Message";

type OllamaSection = InitSettings["embeddingSettings"]["Ollama"] & {
	onChange: (ollamaSettings: InitSettings["embeddingSettings"]["Ollama"]) => void;
};

const loadOllamaModels = (url: string) => {
	vscode.postMessage({
		command: "load-ollama-models",
		value: url
	});
}

export const OllamaSettingsView = ({
	model,
	summaryModel,
	dimensions,
	apiPath,
	modelInfoPath,
	baseUrl,
	onChange,
}: OllamaSection) => {
	const paths = { model, summaryModel, baseUrl, apiPath, modelInfoPath, dimensions };
	const [ollamaModels, setOllamaModels] = useState<string[] | undefined>();

	useEffect(() => {
		loadOllamaModels(baseUrl);

		window.addEventListener("message", handleResponse);
		return () => {
			window.removeEventListener("message", handleResponse);
		};
	}, [baseUrl]);

	// Set default models when ollamaModels are loaded
	// biome-ignore lint/correctness/useExhaustiveDependencies: <explanation>
	useEffect(() => {
		if (ollamaModels && ollamaModels.length > 0) {
			const updatedPaths = { ...paths };
			let shouldUpdate = false;

			// If model is not set or not in the available models list, use the first model
			if (!model || !ollamaModels.includes(model)) {
				updatedPaths.model = ollamaModels[0];
				shouldUpdate = true;
			}

			// If summaryModel is not set or not in the available models list, use the first model
			if (!summaryModel || !ollamaModels.includes(summaryModel)) {
				updatedPaths.summaryModel = ollamaModels[0];
				shouldUpdate = true;
			}

			// Only update if changes were made
			if (shouldUpdate) {
				onChange(updatedPaths);
			}
		}
	}, [ollamaModels, model, summaryModel, dimensions, baseUrl, apiPath, modelInfoPath, onChange]);

	const handleResponse = (event: MessageEvent<AppMessage>) => {
		const { command, value } = event.data;

		switch (command) {
			case "ollama-models": {
				setOllamaModels(value as string[]);
			}
		}
	}

	const handleChangeInput = (e: any) => {
		const field = e.target.getAttribute("data-name");
		const value = e.target.type === "checkbox" ? e.target.checked : e.target.value;
		const clone = { ...paths };
		//@ts-ignore
		clone[field] = value;
		onChange(clone);
	};

	return (
		<div className="flex flex-col space-y-4">

			<div className="flex flex-col">
				<label
					htmlFor="model"
					className="mb-1 text-sm font-medium text-[var(--vscode-foreground)]"
				>
					Model:
				</label>
				<div className="flex gap-2">
					<select
						id="model"
						value={model}
						data-name="model"
						onChange={handleChangeInput}
						className="w-full
							px-3 
							py-2 
							appearance-none
							bg-[var(--vscode-input-background)]
							text-[var(--vscode-input-foreground)]
							border border-[var(--vscode-input-border)]
							rounded-md
							focus:outline-none 
							focus:ring-2 
							focus:ring-[var(--vscode-focusBorder)]
							text-sm
							sm:text-base
							disabled:opacity-50
							disabled:cursor-not-allowed
							"
					>
						{ollamaModels?.map((model) => (
							<option key={model} value={model}>
								{model}
							</option>
						))}
						{!ollamaModels && (
							<option disabled value="">Loading models...</option>
						)}
					</select>
					<button
						type="button"
						onClick={() => loadOllamaModels(baseUrl)}
						className="px-3 py-2 bg-[var(--vscode-button-background)] text-[var(--vscode-button-foreground)] rounded-md hover:bg-[var(--vscode-button-hoverBackground)] focus:outline-none focus:ring-2 focus:ring-[var(--vscode-focusBorder)]"
						title="Refresh models"
					>
						<VscRefresh size={16} />
					</button>
				</div>
				<p className="mt-1 text-xs text-[var(--vscode-descriptionForeground)]">
					Used for embeddings
				</p>
			</div>

			<div className="flex flex-col">
				<label
					htmlFor="summaryModel"
					className="mb-1 text-sm font-medium text-[var(--vscode-foreground)]"
				>
					Summary Model:
				</label>
				<div className="flex gap-2">
					<select
						id="summaryModel"
						value={summaryModel}
						data-name="summaryModel"
						onChange={handleChangeInput}
						className="w-full
							px-3 
							py-2 
							appearance-none
							bg-[var(--vscode-input-background)]
							text-[var(--vscode-input-foreground)]
							border border-[var(--vscode-input-border)]
							rounded-md
							focus:outline-none 
							focus:ring-2 
							focus:ring-[var(--vscode-focusBorder)]
							text-sm
							sm:text-base
							disabled:opacity-50
							disabled:cursor-not-allowed
							"
					>
						{ollamaModels?.map((model) => (
							<option key={model} value={model}>
								{model}
							</option>
						))}
						{!ollamaModels && (
							<option disabled value="">Loading models...</option>
						)}
					</select>
					<button
						type="button"
						onClick={() => loadOllamaModels(baseUrl)}
						className="px-3 py-2 bg-[var(--vscode-button-background)] text-[var(--vscode-button-foreground)] rounded-md hover:bg-[var(--vscode-button-hoverBackground)] focus:outline-none focus:ring-2 focus:ring-[var(--vscode-focusBorder)]"
						title="Refresh models"
					>
						<VscRefresh size={16} />
					</button>
				</div>
				<p className="mt-1 text-xs text-[var(--vscode-descriptionForeground)]">
					Used for summarizing code files
				</p>
			</div>

			<div className="flex flex-col">
				<label
					htmlFor="dimensions"
					className="mb-1 text-sm font-medium text-[var(--vscode-foreground)]"
				>
					Dimensions:
				</label>
				<input
					id="dimensions"
					type="text"
					className="px-3 py-2 bg-[var(--vscode-input-background)] text-[var(--vscode-input-foreground)] border border-[var(--vscode-input-border)] rounded-md focus:outline-none focus:ring-2 focus:ring-[var(--vscode-focusBorder)]"
					onChange={handleChangeInput}
					value={dimensions}
					data-name="dimensions"
					title="Model dimensions"
				/>
			</div>

			<div className="flex flex-col">
				<label
					htmlFor="base-url"
					className="mb-1 text-sm font-medium text-[var(--vscode-foreground)]"
				>
					Base url:
				</label>
				<input
					id="base-url"
					type="text"
					onChange={handleChangeInput}
					value={baseUrl}
					data-name="baseUrl"
					title="Ollama's base path"
					className="px-3 py-2 bg-[var(--vscode-input-background)] text-[var(--vscode-input-foreground)] border border-[var(--vscode-input-border)] rounded-md focus:outline-none focus:ring-2 focus:ring-[var(--vscode-focusBorder)]"
				/>
			</div>

			<div className="flex flex-col">
				<label
					htmlFor="api-path"
					className="mb-1 text-sm font-medium text-[var(--vscode-foreground)]"
				>
					Api path:
				</label>
				<input
					id="api-path"
					type="text"
					onChange={handleChangeInput}
					value={apiPath}
					data-name="apiPath"
					title="Ollama's generation endpoint"
					className="px-3 py-2 bg-[var(--vscode-input-background)] text-[var(--vscode-input-foreground)] border border-[var(--vscode-input-border)] rounded-md focus:outline-none focus:ring-2 focus:ring-[var(--vscode-focusBorder)]"
				/>
			</div>

			<div className="flex flex-col">
				<label
					htmlFor="model-info-path"
					className="mb-1 text-sm font-medium text-[var(--vscode-foreground)]"
				>
					Model info path:
				</label>
				<input
					id="model-info-path"
					type="text"
					onChange={handleChangeInput}
					value={modelInfoPath}
					data-name="modelInfoPath"
					title="Ollama's info path"
					className="px-3 py-2 bg-[var(--vscode-input-background)] text-[var(--vscode-input-foreground)] border border-[var(--vscode-input-border)] rounded-md focus:outline-none focus:ring-2 focus:ring-[var(--vscode-focusBorder)]"
				/>
			</div>
		</div>
	);
};