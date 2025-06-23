import type { ApiSettingsType } from "@shared/types/Settings";
import type { InitSettings } from "./App";
import { useState } from "react";

type AnthropicSection = InitSettings["providerSettings"]["Anthropic"] & {
	onChange: (anthropicSettings: ApiSettingsType) => void;
	enableReasoning?: boolean;
};

export const AnthropicSettingsView = ({
	codeModel,
	chatModel,
	baseUrl,
	apiKey,
	onChange,
	enableReasoning = false,
	sparkMode = false
}: AnthropicSection) => {
	const paths = { codeModel, chatModel, baseUrl, apiKey, enableReasoning, sparkMode };

	const [showPassword, setShowPassword] = useState(false);

	const handleChangeInput = (e: any) => {
		const field = e.target.getAttribute("data-name");
		const clone = { ...paths };
		//@ts-ignore
		clone[field] = e.target.value;
		onChange(clone);
	};

	const handleToggleReasoning = () => {
		const clone = { ...paths };
		clone.enableReasoning = !enableReasoning;
		onChange(clone);
	};

	const handleToggleSparkMode = () => {
		const clone = { ...paths };
		clone.sparkMode = !sparkMode;
		onChange(clone);
	};

	return (
		<div className="space-y-4">
			<div className="flex flex-col">
				<label
					htmlFor="codeModel"
					className="mb-1 text-sm font-medium text-[var(--vscode-editor-foreground)]"
				>
					Code Model:
				</label>
				<input
					id="codeModel"
					type="text"
					onChange={handleChangeInput}
					value={codeModel}
					data-name="codeModel"
					className="px-3 py-2 bg-[var(--vscode-input-background)] text-[var(--vscode-input-foreground)] border border-[var(--vscode-input-border)] rounded-md focus:outline-none focus:ring-2 focus:ring-[var(--vscode-focusBorder)]"
					title="Anthropic Code Model"
				/>
				<p className="mt-1 text-xs text-[var(--vscode-descriptionForeground)]">
					Used for autocomplete code generation (e.g., claude-3-5-haiku-latest)
				</p>
			</div>

			<div className="flex flex-col">
				<label
					htmlFor="chatModel"
					className="mb-1 text-sm font-medium text-[var(--vscode-editor-foreground)]"
				>
					Chat Model:
				</label>
				<input
					id="chatModel"
					type="text"
					onChange={handleChangeInput}
					value={chatModel}
					data-name="chatModel"
					className="px-3 py-2 bg-[var(--vscode-input-background)] text-[var(--vscode-input-foreground)] border border-[var(--vscode-input-border)] rounded-md focus:outline-none focus:ring-2 focus:ring-[var(--vscode-focusBorder)]"
					title="Anthropic Chat Model"
				/>
				<p className="mt-1 text-xs text-[var(--vscode-descriptionForeground)]">
					Used for the Chat Agent experience (e.g., claude-3-7-sonnet-latest)
				</p>
			</div>

			{chatModel.startsWith("claude-3-7-sonnet") && (
				<div className="flex flex-col gap-2 items-center">
					<div className="w-full">
						<input
							id="enableReasoning"
							type="checkbox"
							checked={enableReasoning}
							onChange={handleToggleReasoning}
							className="w-4 h-4 text-blue-600 bg-[var(--vscode-input-background)] border-[var(--vscode-input-border)] rounded focus:ring-[var(--vscode-focusBorder)]"
						/>
						<label
							htmlFor="enableReasoning"
							className="ml-2 text-sm font-medium text-[var(--vscode-editor-foreground)]"
						>
							Enable Thinking
						</label>
					</div>
					<div className="text-xs w-full text-[var(--vscode-descriptionForeground)]">
						(Improves code generation quality but may increase latency)
					</div>
				</div>
			)}

			<div className="flex flex-col">
				<label
					htmlFor="baseUrl"
					className="mb-1 text-sm font-medium text-[var(--vscode-editor-foreground)]"
				>
					Base url:
				</label>
				<input
					id="baseUrl"
					type="text"
					onChange={handleChangeInput}
					value={baseUrl}
					data-name="baseUrl"
					className="px-3 py-2 bg-[var(--vscode-input-background)] text-[var(--vscode-input-foreground)] border border-[var(--vscode-input-border)] rounded-md focus:outline-none focus:ring-2 focus:ring-[var(--vscode-focusBorder)]"
					title="Anthropic base url"
				/>
			</div>

			<div className="flex flex-col">
				<label
					htmlFor="apiKey"
					className="mb-1 text-sm font-medium text-[var(--vscode-editor-foreground)]"
				>
					API Key:
				</label>
				<div className="relative">
					<input
						id="apiKey"
						type={showPassword ? "text" : "password"}
						onChange={handleChangeInput}
						value={apiKey}
						data-name="apiKey"
						className={`w-full px-3 pr-12 py-2 bg-[var(--vscode-input-background)] text-[var(--vscode-input-foreground)] border border-[var(--vscode-input-border)] rounded-md focus:outline-none focus:ring-2 focus:ring-[var(--vscode-focusBorder)] ${!apiKey ? "border-red-500" : ""
							}`}
						title={!apiKey ? "Please add your Anthropic API key" : "Anthropic api key"}
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