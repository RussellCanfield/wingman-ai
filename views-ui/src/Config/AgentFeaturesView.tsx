import type { ValidationSettings } from "@shared/types/Settings";
import type { InitSettings } from "./App";

export type AgentFeatureViewProps = {
	validationSettings: InitSettings["validationSettings"];
	onValidationChanged: (validationSettings: ValidationSettings) => void;
};

export const AgentFeaturesView = ({
	validationSettings,
	onValidationChanged,
}: AgentFeatureViewProps) => {
	const paths = { ...validationSettings };

	const handleChangeInput = (e: any) => {
		const field = e.target.getAttribute("data-name");
		const value = e.target.type === "checkbox" ? e.target.checked : e.target.value;
		const clone = { ...paths };
		clone[field as keyof ValidationSettings] = value;
		onValidationChanged(clone);
	};

	return (
		<div className="container mx-auto mb-8">
			<div className="flex flex-col gap-4">
				<div className="flex flex-row items-center gap-2">
					<input
						id="automaticallyFixDiagnostics"
						type="checkbox"
						className="px-3 py-2 bg-[var(--vscode-input-background)] text-[var(--vscode-input-foreground)] border border-[var(--vscode-input-border)] rounded-md focus:outline-none focus:ring-2 focus:ring-[var(--vscode-focusBorder)]"
						onChange={handleChangeInput}
						placeholder="npm run typecheck"
						checked={paths.automaticallyFixDiagnostics}
						data-name="automaticallyFixDiagnostics"
						title="Automatically Fix Errors"
					/>
					<label
						htmlFor="automaticallyFixDiagnostics"
						className="text-sm font-medium text-[var(--vscode-foreground)]"
					>
						Automatically Fix Import/Lint Errors
					</label>
				</div>
			</div>
		</div>
	);
};