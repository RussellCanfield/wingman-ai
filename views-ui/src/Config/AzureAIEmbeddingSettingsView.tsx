import { AzureAIEmbeddingSettingsType } from "@shared/types/Settings";

type AzureAIEmbeddingSection = AzureAIEmbeddingSettingsType & {
	onChange: (azureAISettings: AzureAIEmbeddingSettingsType) => void;
};

export const AzureAIEmbeddingSettingsView = ({
	dimensions,
	embeddingModel,
	apiKey,
	enabled,
	instanceName,
	apiVersion,
	onChange,
}: AzureAIEmbeddingSection) => {
	const paths = {
		dimensions,
		embeddingModel,
		apiKey,
		instanceName,
		apiVersion,
		enabled,
	};
	const handleChangeInput = (e: any) => {
		const field = e.target.getAttribute("data-name");
		const clone = { ...paths };
		//@ts-expect-error
		clone[field] = e.target.value;
		onChange(clone);
	};

	const handleCheckboxChange = (e: any) => {
		const field = e.target.getAttribute("data-name");
		const clone = { ...paths };
		//@ts-expect-error
		clone[field] = e.target.checked;
		onChange(clone);
	};

	return (
		<div className="flex flex-col space-y-4">
			<div className="flex flex-col">
				<label
					htmlFor="embeddingModel"
					className="mb-1 text-sm font-medium"
				>
					Embedding model:
				</label>
				<input
					id="embeddingModel"
					type="text"
					className="px-3 py-2 border focus:outline-none focus:ring-2 focus:ring-[var(--vscode-focusBorder)] bg-[var(--vscode-input-background)] border-[var(--vscode-editor-foreground)]"
					onChange={handleChangeInput}
					value={embeddingModel}
					data-name="embeddingModel"
					title="Embedding model"
				/>
			</div>

			<div className="flex flex-col">
				<label
					htmlFor="dimensions"
					className="mb-1 text-sm font-medium"
				>
					Dimensions:
				</label>
				<input
					id="dimensions"
					type="text"
					className="px-3 py-2 border focus:outline-none focus:ring-2 focus:ring-[var(--vscode-focusBorder)] bg-[var(--vscode-input-background)] border-[var(--vscode-editor-foreground)]"
					onChange={handleChangeInput}
					value={dimensions}
					data-name="dimensions"
					title="The dimensions for the embedding model"
				/>
			</div>

			<div className="flex flex-col">
				<label
					htmlFor="instanceName"
					className="mb-1 text-sm font-medium"
				>
					Instance Name:
				</label>
				<input
					id="instanceName"
					type="text"
					className="px-3 py-2 border focus:outline-none focus:ring-2 focus:ring-[var(--vscode-focusBorder)] bg-[var(--vscode-input-background)] border-[var(--vscode-editor-foreground)]"
					onChange={handleChangeInput}
					value={instanceName}
					data-name="instanceName"
					title="AzureAI Instance Name"
				/>
			</div>

			<div className="flex flex-col">
				<label
					htmlFor="apiVersion"
					className="mb-1 text-sm font-medium"
				>
					Api Version:
				</label>
				<input
					id="apiVersion"
					type="text"
					className="px-3 py-2 border focus:outline-none focus:ring-2 focus:ring-[var(--vscode-focusBorder)] bg-[var(--vscode-input-background)] border-[var(--vscode-editor-foreground)]"
					onChange={handleChangeInput}
					value={apiVersion}
					data-name="apiVersion"
					title="AzureAI Api Version"
				/>
			</div>

			<div className="flex flex-col">
				<label htmlFor="apiKey" className="mb-1 text-sm font-medium">
					Api Key:
				</label>
				<input
					id="apiKey"
					type="password"
					className="px-3 py-2 border focus:outline-none focus:ring-2 focus:ring-[var(--vscode-focusBorder)] bg-[var(--vscode-input-background)] border-[var(--vscode-editor-foreground)]"
					onChange={handleChangeInput}
					value={apiKey}
					data-name="apiKey"
					title="AzureAI api key"
				/>
			</div>

			<div className="flex items-center space-x-2">
				<label htmlFor="enabled" className="text-sm font-medium">
					Enabled:
				</label>
				<input
					id="enabled"
					type="checkbox"
					className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
					checked={enabled}
					onChange={handleCheckboxChange}
					data-name="enabled"
					title="Enable AzureAI Embeddings"
				/>
			</div>
		</div>
	);
};
