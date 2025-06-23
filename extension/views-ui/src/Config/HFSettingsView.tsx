import type { ApiSettingsType } from "@shared/types/Settings";
import type { InitSettings } from "./App";

type HFSection = InitSettings["providerSettings"]["HuggingFace"] & {
	onChange: (ollamaSettings: ApiSettingsType) => void;
};
export const HFSettingsView = ({
	codeModel,
	chatModel,
	baseUrl,
	apiKey,
	onChange,
}: HFSection) => {
	const paths = { codeModel, chatModel, baseUrl, apiKey };
	const handleChangeInput = (e: any) => {
		const field = e.target.getAttribute("data-name");
		const clone = { ...paths };
		//@ts-ignore
		clone[field] = e.target.value;
		onChange(clone);
	};

	return (
		<div className="flex flex-col space-y-4">
			<div className="flex flex-col">
				<label htmlFor="codeModel" className="mb-1 text-sm font-medium">
					Code Model:
				</label>
				<input
					id="codeModel"
					type="text"
					className="px-3 py-2 bg-[var(--vscode-input-background)] text-[var(--vscode-input-foreground)] border border-[var(--vscode-input-border)] rounded-md focus:outline-none focus:ring-2 focus:ring-[var(--vscode-focusBorder)]"
					onChange={handleChangeInput}
					value={codeModel}
					data-name="codeModel"
					title="HF Code Model"
				/>
				<p className="mt-1 text-xs text-[var(--vscode-descriptionForeground)]">
					Used for autocomplete code generation
				</p>
			</div>

			<div className="flex flex-col">
				<label htmlFor="chatModel" className="mb-1 text-sm font-medium">
					Chat Model:
				</label>
				<input
					id="chatModel"
					type="text"
					className="px-3 py-2 bg-[var(--vscode-input-background)] text-[var(--vscode-input-foreground)] border border-[var(--vscode-input-border)] rounded-md focus:outline-none focus:ring-2 focus:ring-[var(--vscode-focusBorder)]"
					onChange={handleChangeInput}
					value={chatModel}
					data-name="chatModel"
					title="HF Chat Model"
				/>
				<p className="mt-1 text-xs text-[var(--vscode-descriptionForeground)]">
					Used for the Chat Agent experience
				</p>
			</div>

			<div className="flex flex-col">
				<label htmlFor="baseUrl" className="mb-1 text-sm font-medium">
					Base url:
				</label>
				<input
					id="baseUrl"
					type="text"
					className="px-3 py-2 bg-[var(--vscode-input-background)] text-[var(--vscode-input-foreground)] border border-[var(--vscode-input-border)] rounded-md focus:outline-none focus:ring-2 focus:ring-[var(--vscode-focusBorder)]"
					onChange={handleChangeInput}
					value={baseUrl}
					data-name="baseUrl"
					title="HF base url"
				/>
			</div>

			<div className="flex flex-col">
				<label htmlFor="apiKey" className="mb-1 text-sm font-medium">
					Api key:
				</label>
				<input
					id="apiKey"
					type="password"
					className="px-3 py-2 bg-[var(--vscode-input-background)] text-[var(--vscode-input-foreground)] border border-[var(--vscode-input-border)] rounded-md focus:outline-none focus:ring-2 focus:ring-[var(--vscode-focusBorder)]"
					onChange={handleChangeInput}
					value={apiKey}
					data-name="apiKey"
					title="HF api key"
				/>
			</div>
		</div>
	);
};