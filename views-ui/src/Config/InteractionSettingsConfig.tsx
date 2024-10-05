import { Settings } from "@shared/types/Settings";

type InteractionSettings = Required<Settings>["interactionSettings"];
const tooltipInformation = {
	completion:
		"Enable this setting activates code completion. Code completion will run when you type in a file for a supported language.",
	streaming:
		"Enabling this setting activates code streaming for code completion, prioritizing faster code completion results over detailed suggestions by providing shorter responses.",
	ccw: "Adjust the context window size to determine the amount of context included in code completion. Starting with a lower value (e.g., 128) is recommended, increasing as needed for better performance on more powerful setups.",
	cmt: "Controls the maximum number of tokens returned by code completion. Here we recommend starting low at 128.",
	chcw: "Adjust the context window size to determine the amount of context included in chat request. We start this at 4096, depending on the LLM you use it can be increased.",
	chmt: "Controls the maximum number of tokens returned by the chat request. Here we also start at 4096.",
};

export type InteractionSettingsConfigProps = {
	interactions: InteractionSettings;
	onChange: (settings: InteractionSettings) => void;
};

export const InteractionSettingsConfig = ({
	interactions,
	onChange,
}: InteractionSettingsConfigProps) => {
	const handleCompletionChange = (e: any) => {
		const clone = { ...interactions };
		if (e.target.value === "true") {
			clone.codeCompletionEnabled = true;
		} else if (e.target.value === "false") {
			clone.codeCompletionEnabled = false;
		}
		onChange(clone);
	};

	const handleStreamChange = (e: any) => {
		const clone = { ...interactions };
		if (e.target.value === "true") {
			clone.codeStreaming = true;
		} else if (e.target.value === "false") {
			clone.codeStreaming = false;
		}
		onChange(clone);
	};

	const handleChange = (e: any) => {
		const number = Number(e.target.value);
		if (!number) return;
		const field = e.target.getAttribute("data-name");
		const clone = { ...interactions };
		//@ts-ignore
		clone[field] = number;
		onChange(clone);
	};

	return (
		<div className="container mx-auto p-4">
			<div className="mb-4">
				<label htmlFor="code-completion" className="block mb-2">
					Code Completion enabled:
				</label>
				<select
					id="code-completion"
					className="w-full min-w-[200px] p-2 border rounded focus:outline-none focus:ring-2 focus:ring-[var(--vscode-focusBorder)] bg-[var(--vscode-input-background)] border-[var(--vscode-editor-foreground)]"
					title={tooltipInformation.completion}
					data-name="codeCompletionEnabled"
					onChange={handleCompletionChange}
					value={interactions.codeCompletionEnabled.toString()}
				>
					<option>true</option>
					<option>false</option>
				</select>
			</div>

			<div className="mb-4">
				<label htmlFor="code-streaming" className="block mb-2">
					Code streaming:
				</label>
				<select
					id="code-streaming"
					className="w-full min-w-[200px] p-2 border rounded focus:outline-none focus:ring-2 focus:ring-[var(--vscode-focusBorder)] bg-[var(--vscode-input-background)] border-[var(--vscode-editor-foreground)]"
					title={tooltipInformation.streaming}
					data-name="codeStreaming"
					onChange={handleStreamChange}
					value={interactions.codeStreaming.toString()}
				>
					<option>true</option>
					<option>false</option>
				</select>
			</div>

			{[
				"codeContextWindow",
				"codeMaxTokens",
				"chatContextWindow",
				"chatMaxTokens",
			].map((field) => (
				<div key={field} className="mb-4">
					<label htmlFor={field} className="block mb-2">
						{`${field
							.replace(/([A-Z])/g, " $1")
							.replace(/^./, (str) => str.toUpperCase())}:`}
					</label>
					<input
						type="text"
						id={field}
						className="w-full p-2 border rounded focus:outline-none focus:ring-2 focus:ring-[var(--vscode-focusBorder)] bg-[var(--vscode-input-background)] text-[var(--vscode-editor-foreground)]"
						title={
							//@ts-expect-error
							tooltipInformation[
								field.replace(/([A-Z])/g, "_$1").toLowerCase()
							]
						}
						data-name={field}
						//@ts-expect-error
						value={interactions[field].toString()}
						onChange={handleChange}
					/>
				</div>
			))}
		</div>
	);
};
