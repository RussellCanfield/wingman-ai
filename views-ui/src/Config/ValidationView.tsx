import type { ValidationSettings } from "@shared/types/Settings";
import type { InitSettings } from "./App";

export type ValidationProps = {
	validationSettings: InitSettings["validationSettings"];
	onValidationChanged: (validationSettings: ValidationSettings) => void;
};

export const ValidationView = ({
	validationSettings,
	onValidationChanged,
}: ValidationProps) => {
	const paths = { ...validationSettings };

	const handleChangeInput = (e: any) => {
		const field = e.target.getAttribute("data-name");
		const value = e.target.type === "checkbox" ? e.target.checked : e.target.value;
		const clone = { ...paths };
		clone[field as keyof ValidationSettings] = value;
		onValidationChanged(clone);
	};

	return (
		<div className="container mx-auto p-4">
			<div className="flex flex-col gap-4">
				<div className="flex flex-col">
					<label
						htmlFor="validationCommand"
						className="mb-1 text-sm font-medium text-[var(--vscode-foreground)]"
					>
						Validation Command:
					</label>
					<input
						id="validationCommand"
						type="text"
						className="px-3 py-2 bg-[var(--vscode-input-background)] text-[var(--vscode-input-foreground)] border border-[var(--vscode-input-border)] rounded-md focus:outline-none focus:ring-2 focus:ring-[var(--vscode-focusBorder)]"
						onChange={handleChangeInput}
						placeholder="npm run typecheck"
						value={paths.validationCommand}
						data-name="validationCommand"
						title="Validation Command"
					/>
				</div>
			</div>
		</div>
	);
};