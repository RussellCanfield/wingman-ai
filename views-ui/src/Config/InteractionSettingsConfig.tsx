import type { Settings } from "@shared/types/Settings";
import { Tooltip } from "react-tooltip";
import { FaInfoCircle, FaCode, FaBolt, FaWindowMaximize, FaCommentAlt } from "react-icons/fa";
import { useState } from "react";

type InteractionSettings = Required<Settings>["interactionSettings"];
const tooltipInformation = {
	completion:
		"Enable this setting activates code completion. Code completion will run when you type in a file for a supported language.",
	streaming:
		"Enabling this setting activates code streaming for code completion, prioritizing faster code completion results over detailed suggestions by providing shorter responses.",
	codeContextWindow:
		"Adjust the context window size to determine the amount of context included in code completion. Starting with a lower value (e.g., 128) is recommended, increasing as needed for better performance on more powerful setups.",
	codeMaxTokens:
		"Controls the maximum number of tokens returned by code completion. Here we recommend starting low at 128.",
	chatContextWindow:
		"Adjust the context window size to determine the amount of context included in chat request. We start this at 4096, depending on the LLM you use it can be increased.",
	chatMaxTokens:
		"Controls the maximum number of tokens returned by the chat request. Here we also start at 4096.",
};

export type InteractionSettingsConfigProps = {
	interactions: InteractionSettings;
	onChange: (settings: InteractionSettings) => void;
};

export const InteractionSettingsConfig = ({
	interactions,
	onChange,
}: InteractionSettingsConfigProps) => {
	const [theme, setTheme] = useState(() => {
		// Detect if we're using a light theme based on VSCode variables
		const computedStyle = getComputedStyle(document.documentElement);
		const bgColor = computedStyle.getPropertyValue('--vscode-editor-background');
		return bgColor.trim().toLowerCase() === '#ffffff' ? 'light' : 'dark';
	});

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

	const getIconForField = (field: string) => {
		switch (field) {
			case "codeCompletionEnabled":
				return <FaCode className="text-blue-500" />;
			case "codeStreaming":
				return <FaBolt className="text-yellow-500" />;
			case "codeContextWindow":
			case "chatContextWindow":
				return <FaWindowMaximize className="text-green-500" />;
			case "codeMaxTokens":
			case "chatMaxTokens":
				return <FaCommentAlt className="text-purple-500" />;
			default:
				return <FaInfoCircle className="text-gray-500" />;
		}
	};

	// Helper function to get tooltip content for a field
	const getTooltipContent = (field: string): string => {
		// Direct mapping for fields that match tooltip keys
		if (field in tooltipInformation) {
			return tooltipInformation[field as keyof typeof tooltipInformation];
		}

		// Map special cases
		switch (field) {
			case "codeCompletionEnabled":
				return tooltipInformation.completion;
			case "codeStreaming":
				return tooltipInformation.streaming;
			default:
				return "No tooltip information available";
		}
	};

	return (
		<div className="container mx-auto p-4">
			<div className="mb-4">
				<div className="flex items-center mb-2">
					<label htmlFor="code-completion" className="block mr-2">
						Code Completion enabled:
					</label>
					<span
						data-tooltip-id="completion-tooltip"
						className="cursor-help transition-transform hover:scale-110"
					>
						{getIconForField("codeCompletionEnabled")}
					</span>
					<Tooltip
						id="completion-tooltip"
						content={tooltipInformation.completion}
						place="right"
						className="max-w-xs z-50"
						style={{
							backgroundColor: theme === 'light' ? '#333' : '#f5f5f5',
							color: theme === 'light' ? '#fff' : '#333',
							borderRadius: '6px',
							padding: '8px 12px',
							boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)'
						}}
					/>
				</div>
				<select
					id="code-completion"
					className="w-full min-w-[200px] p-2 border rounded focus:outline-none focus:ring-2 focus:ring-[var(--vscode-focusBorder)] bg-[var(--vscode-input-background)] border-[var(--vscode-editor-foreground)]"
					data-name="codeCompletionEnabled"
					onChange={handleCompletionChange}
					value={interactions.codeCompletionEnabled.toString()}
				>
					<option>true</option>
					<option>false</option>
				</select>
			</div>

			<div className="mb-4">
				<div className="flex items-center mb-2">
					<label htmlFor="code-streaming" className="block mr-2">
						Code streaming:
					</label>
					<span
						data-tooltip-id="streaming-tooltip"
						className="cursor-help transition-transform hover:scale-110"
					>
						{getIconForField("codeStreaming")}
					</span>
					<Tooltip
						id="streaming-tooltip"
						content={tooltipInformation.streaming}
						place="right"
						className="max-w-xs z-50"
						style={{
							backgroundColor: theme === 'light' ? '#333' : '#f5f5f5',
							color: theme === 'light' ? '#fff' : '#333',
							borderRadius: '6px',
							padding: '8px 12px',
							boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)'
						}}
					/>
				</div>
				<select
					id="code-streaming"
					className="w-full min-w-[200px] p-2 border rounded focus:outline-none focus:ring-2 focus:ring-[var(--vscode-focusBorder)] bg-[var(--vscode-input-background)] border-[var(--vscode-editor-foreground)]"
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
			].map((field) => {
				const tooltipId = `${field}-tooltip`;

				return (
					<div key={field} className="mb-4">
						<div className="flex items-center mb-2">
							<label htmlFor={field} className="block mr-2">
								{`${field
									.replace(/([A-Z])/g, " $1")
									.replace(/^./, (str) => str.toUpperCase())}:`}
							</label>
							<span
								data-tooltip-id={tooltipId}
								className="cursor-help transition-transform hover:scale-110"
							>
								{getIconForField(field)}
							</span>
							<Tooltip
								id={tooltipId}
								content={getTooltipContent(field)}
								place="right"
								className="max-w-xs z-50"
								style={{
									backgroundColor: theme === 'light' ? '#333' : '#f5f5f5',
									color: theme === 'light' ? '#fff' : '#333',
									borderRadius: '6px',
									padding: '8px 12px',
									boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)'
								}}
							/>
						</div>
						<input
							type="text"
							id={field}
							className="w-full p-2 border rounded focus:outline-none focus:ring-2 focus:ring-[var(--vscode-focusBorder)] bg-[var(--vscode-input-background)] text-[var(--vscode-editor-foreground)]"
							data-name={field}
							value={interactions[field as keyof InteractionSettings].toString()}
							onChange={handleChange}
						/>
					</div>
				);
			})}
		</div>
	);
};