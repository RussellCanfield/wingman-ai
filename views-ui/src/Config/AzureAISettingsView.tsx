import { ApiSettingsType } from "@shared/types/Settings";
import { InitSettings } from "./App";

type AzureAISection = InitSettings["providerSettings"]["AzureAI"] & {
	onChange: (azureAISettings: ApiSettingsType) => void;
};
export const AzureAISettingsView = ({
	codeModel,
	chatModel,
	baseUrl,
	apiKey,
	onChange,
}: AzureAISection) => {
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
				<label
					htmlFor="codeModel"
					className="mb-1 text-sm font-medium text-[var(--vscode-foreground)]"
				>
					Code Model:
				</label>
				<input
					id="codeModel"
					type="text"
					className="px-3 py-2 bg-[var(--vscode-input-background)] text-[var(--vscode-input-foreground)] border border-[var(--vscode-input-border)] rounded-md focus:outline-none focus:ring-2 focus:ring-[var(--vscode-focusBorder)]"
					onChange={handleChangeInput}
					value={codeModel}
					data-name="codeModel"
					title="AzureAI Code Model"
				/>
			</div>

			<div className="flex flex-col">
				<label
					htmlFor="chatModel"
					className="mb-1 text-sm font-medium text-[var(--vscode-foreground)]"
				>
					Chat Model:
				</label>
				<input
					id="chatModel"
					type="text"
					className="px-3 py-2 bg-[var(--vscode-input-background)] text-[var(--vscode-input-foreground)] border border-[var(--vscode-input-border)] rounded-md focus:outline-none focus:ring-2 focus:ring-[var(--vscode-focusBorder)]"
					onChange={handleChangeInput}
					value={chatModel}
					data-name="chatModel"
					title="AzureAI Chat Model"
				/>
			</div>

			<div className="flex flex-col">
				<label
					htmlFor="baseUrl"
					className="mb-1 text-sm font-medium text-[var(--vscode-foreground)]"
				>
					Base url:
				</label>
				<input
					id="baseUrl"
					type="text"
					className="px-3 py-2 bg-[var(--vscode-input-background)] text-[var(--vscode-input-foreground)] border border-[var(--vscode-input-border)] rounded-md focus:outline-none focus:ring-2 focus:ring-[var(--vscode-focusBorder)]"
					onChange={handleChangeInput}
					value={baseUrl}
					data-name="baseUrl"
					title="AzureAI base url"
				/>
			</div>

			<div className="flex flex-col">
				<label
					htmlFor="apiKey"
					className="mb-1 text-sm font-medium text-[var(--vscode-foreground)]"
				>
					Api key:
				</label>
				<input
					id="apiKey"
					type="password"
					className="px-3 py-2 bg-[var(--vscode-input-background)] text-[var(--vscode-input-foreground)] border border-[var(--vscode-input-border)] rounded-md focus:outline-none focus:ring-2 focus:ring-[var(--vscode-focusBorder)]"
					onChange={handleChangeInput}
					value={apiKey}
					data-name="apiKey"
					title="AzureAI api key"
				/>
			</div>
		</div>
	);
};
