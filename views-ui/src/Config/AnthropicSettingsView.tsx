import { ApiSettingsType } from "@shared/types/Settings";
import { InitSettings } from "./App";

type AnthropicSection = InitSettings["providerSettings"]["Anthropic"] & {
	onChange: (anthropicSettings: ApiSettingsType) => void;
};
export const AnthropicSettingsView = ({
	codeModel,
	chatModel,
	baseUrl,
	apiKey,
	onChange,
}: AnthropicSection) => {
	const paths = { codeModel, chatModel, baseUrl, apiKey };
	const handleChangeInput = (e: any) => {
		const field = e.target.getAttribute("data-name");
		const clone = { ...paths };
		//@ts-ignore
		clone[field] = e.target.value;
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
			</div>

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
				<input
					id="apiKey"
					type="password"
					onChange={handleChangeInput}
					value={apiKey}
					data-name="apiKey"
					className="px-3 py-2 bg-[var(--vscode-input-background)] text-[var(--vscode-input-foreground)] border border-[var(--vscode-input-border)] rounded-md focus:outline-none focus:ring-2 focus:ring-[var(--vscode-focusBorder)]"
					title="Anthropic api key"
				/>
			</div>
		</div>
	);
};
