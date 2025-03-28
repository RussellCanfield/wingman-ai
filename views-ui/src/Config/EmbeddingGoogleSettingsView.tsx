import type { InitSettings } from "./App";
import { useState } from "react";

type GoogleSection = InitSettings["embeddingSettings"]["Google"] & {
	onChange: (googleSettings: InitSettings["embeddingSettings"]["Google"]) => void;
};
export const GoogleSettingsView = ({
	model,
	summaryModel,
	baseUrl,
	dimensions,
	apiKey,
	onChange,
}: GoogleSection) => {
	const paths = { baseUrl, apiKey, model, summaryModel, dimensions };

	const [showPassword, setShowPassword] = useState(false);

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
				<input
					id="model"
					type="text"
					className="px-3 py-2 bg-[var(--vscode-input-background)] text-[var(--vscode-input-foreground)] border border-[var(--vscode-input-border)] rounded-md focus:outline-none focus:ring-2 focus:ring-[var(--vscode-focusBorder)]"
					onChange={handleChangeInput}
					value={model}
					data-name="model"
					title="Google Model"
				/>
				<p className="mt-1 text-xs text-[var(--vscode-descriptionForeground)]">
					Used for embeddings (eg: gemini-embedding-exp-03-07)
				</p>
			</div>

			<div className="flex flex-col">
				<label
					htmlFor="summaryModel"
					className="mb-1 text-sm font-medium text-[var(--vscode-foreground)]"
				>
					Summary Model:
				</label>
				<input
					id="summaryModel"
					type="text"
					className="px-3 py-2 bg-[var(--vscode-input-background)] text-[var(--vscode-input-foreground)] border border-[var(--vscode-input-border)] rounded-md focus:outline-none focus:ring-2 focus:ring-[var(--vscode-focusBorder)]"
					onChange={handleChangeInput}
					value={summaryModel}
					data-name="summaryModel"
					title="Google Summary Model"
				/>
				<p className="mt-1 text-xs text-[var(--vscode-descriptionForeground)]">
					Used for parsing code files before embeddings (can be small like gemini-2.0-flash)
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
					htmlFor="apiKey"
					className="mb-1 text-sm font-medium text-[var(--vscode-foreground)]"
				>
					Api key:
				</label>
				<div className="relative">
					<input
						id="apiKey"
						type={showPassword ? "text" : "password"}
						className={`w-full px-3 pr-12 py-2 bg-[var(--vscode-input-background)] text-[var(--vscode-input-foreground)] border border-[var(--vscode-input-border)] rounded-md focus:outline-none focus:ring-2 focus:ring-[var(--vscode-focusBorder)] ${!apiKey ? "border-red-500" : ""
							}`}
						onChange={handleChangeInput}
						value={apiKey}
						data-name="apiKey"
						title={!apiKey ? "Please add your Google AI Studio API key" : "Google AI Studio api key"}
					/>
					<button
						type="button"
						className="absolute inset-y-0 right-0 px-3 flex items-center text-[var(--vscode-foreground)]"
						onClick={() => setShowPassword(!showPassword)}
						title={showPassword ? "Hide API Key" : "Show API Key"}
					>
						{showPassword ? (
							// biome-ignore lint/a11y/noSvgWithoutTitle: <explanation>
							<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
								<path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88" />
							</svg>
						) : (
							// biome-ignore lint/a11y/noSvgWithoutTitle: <explanation>
							<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
								<path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
								<path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
							</svg>
						)}
					</button>
				</div>
			</div>
		</div>
	);
};