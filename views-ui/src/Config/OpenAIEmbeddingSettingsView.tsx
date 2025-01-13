import { useState } from 'react';
import { OpenAIEmbeddingSettingsType } from "@shared/types/Settings";

type OpenAIEmbeddingSection = OpenAIEmbeddingSettingsType & {
	onChange: (openAISettings: OpenAIEmbeddingSettingsType) => void;
};

export const OpenAIEmbeddingSettingsView = ({
	dimensions,
	embeddingModel,
	apiKey,
	enabled,
	onChange,
}: OpenAIEmbeddingSection) => {
	const [showPassword, setShowPassword] = useState(false);
	const paths = { dimensions, embeddingModel, apiKey, enabled };

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
				<label htmlFor="apiKey" className="mb-1 text-sm font-medium">
					Api key:
				</label>
				<div className="relative">
					<input
						id="apiKey"
						type={showPassword ? "text" : "password"}
						className={`w-full px-3 pr-12 py-2 border focus:outline-none focus:ring-2 focus:ring-[var(--vscode-focusBorder)] bg-[var(--vscode-input-background)] border-[var(--vscode-editor-foreground)] ${apiKey.toLowerCase() === "add me" ? "border-red-500" : ""
							}`}
						onChange={handleChangeInput}
						value={apiKey}
						data-name="apiKey"
						title={apiKey.toLowerCase() === "add me" ? "Please add your OpenAI API key" : "OpenAI API key"}
					/>
					<button
						type="button"
						className="absolute inset-y-0 right-0 px-3 flex items-center"
						onClick={() => setShowPassword(!showPassword)}
						title={showPassword ? "Hide API Key" : "Show API Key"}
					>
						{showPassword ? (
							<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
								<path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88" />
							</svg>
						) : (
							<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
								<path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
								<path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
							</svg>
						)}
					</button>
				</div>
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
					title="Enable OpenAI Embeddings"
				/>
			</div>
		</div>
	);
};