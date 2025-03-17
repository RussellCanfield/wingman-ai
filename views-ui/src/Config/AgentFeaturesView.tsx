import type { AgentSettings } from "@shared/types/Settings";
import type { InitSettings } from "./App";
import { useState } from "react";
import { Tooltip } from "react-tooltip";
import { FaInfoCircle, FaMagic, FaWrench } from "react-icons/fa";
import { MdOutlineAudiotrack } from "react-icons/md";

export type AgentFeatureViewProps = {
	validationSettings: InitSettings["agentSettings"];
	onValidationChanged: (validationSettings: AgentSettings) => void;
};

// Tooltip information for each setting
const tooltipInformation = {
	vibeMode: "Vibe mode automatically applies file edits and executes commands. You can undo file edits.",
	automaticallyFixDiagnostics: "When enabled, Wingman will automatically fix import and linting errors in your code, improving code quality without manual intervention.",
	playAudioAlert: "Play an audio alert on chat completion, or a change is awaiting an approval"
};

export const AgentFeaturesView = ({
	validationSettings,
	onValidationChanged,
}: AgentFeatureViewProps) => {
	const paths = { ...validationSettings };

	// Detect theme (light/dark) for tooltip styling
	const [theme] = useState(() => {
		// Detect if we're using a light theme based on VSCode variables
		const computedStyle = getComputedStyle(document.documentElement);
		const bgColor = computedStyle.getPropertyValue('--vscode-editor-background');
		return bgColor.trim().toLowerCase() === '#ffffff' ? 'light' : 'dark';
	});

	const handleChangeInput = (e: any) => {
		const field = e.target.getAttribute("data-name");
		const value = e.target.type === "checkbox" ? e.target.checked : e.target.value;
		const clone = { ...paths };
		clone[field as keyof AgentSettings] = value;
		onValidationChanged(clone);
	};

	// Helper function to get the appropriate icon for each setting
	const getIconForField = (field: string) => {
		switch (field) {
			case "vibeMode":
				return <FaMagic className="text-purple-500" />;
			case "automaticallyFixDiagnostics":
				return <FaWrench className="text-blue-500" />;
			case "playAudioAlert":
				return <MdOutlineAudiotrack className="text-indigo-500" size={16} />
			default:
				return <FaInfoCircle className="text-gray-500" />;
		}
	};

	return (
		<div className="container mx-auto mb-8">
			<div className="flex flex-col gap-4">
				<div className="flex flex-row items-start gap-2">
					<div className="flex items-center gap-2">
						<input
							id="vibeMode"
							type="checkbox"
							className="px-3 py-2 bg-[var(--vscode-input-background)] text-[var(--vscode-input-foreground)] border border-[var(--vscode-input-border)] rounded-md focus:outline-none focus:ring-2 focus:ring-[var(--vscode-focusBorder)]"
							onChange={handleChangeInput}
							checked={paths.vibeMode}
							data-name="vibeMode"
							title="Vibe Mode"
						/>
						<label
							htmlFor="vibeMode"
							className="text-sm font-medium text-[var(--vscode-foreground)]"
						>
							Vibe Mode
						</label>
						<span
							data-tooltip-id="vibe-mode-tooltip"
							className="cursor-help transition-transform hover:scale-110"
						>
							{getIconForField("vibeMode")}
						</span>
						<Tooltip
							id="vibe-mode-tooltip"
							content={tooltipInformation.vibeMode}
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
				</div>
				<div className="flex flex-row items-center gap-2">
					<input
						id="automaticallyFixDiagnostics"
						type="checkbox"
						className="px-3 py-2 bg-[var(--vscode-input-background)] text-[var(--vscode-input-foreground)] border border-[var(--vscode-input-border)] rounded-md focus:outline-none focus:ring-2 focus:ring-[var(--vscode-focusBorder)]"
						onChange={handleChangeInput}
						checked={paths.automaticallyFixDiagnostics}
						data-name="automaticallyFixDiagnostics"
						title="Automatically Fix Errors"
					/>
					<label
						htmlFor="automaticallyFixDiagnostics"
						className="text-sm font-medium text-[var(--vscode-foreground)]"
					>
						Auto Fix
					</label>
					<span
						data-tooltip-id="fix-diagnostics-tooltip"
						className="cursor-help transition-transform hover:scale-110"
					>
						{getIconForField("automaticallyFixDiagnostics")}
					</span>
					<Tooltip
						id="fix-diagnostics-tooltip"
						content={tooltipInformation.automaticallyFixDiagnostics}
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
				<div className="flex flex-row items-center gap-2">
					<input
						id="playAudioAlert"
						type="checkbox"
						className="px-3 py-2 bg-[var(--vscode-input-background)] text-[var(--vscode-input-foreground)] border border-[var(--vscode-input-border)] rounded-md focus:outline-none focus:ring-2 focus:ring-[var(--vscode-focusBorder)]"
						onChange={handleChangeInput}
						checked={paths.playAudioAlert}
						data-name="playAudioAlert"
						title="Play an audio alert when finished"
					/>
					<label
						htmlFor="playAudioAlert"
						className="text-sm font-medium text-[var(--vscode-foreground)]"
					>
						Audio Alert
					</label>
					<span
						data-tooltip-id="audio-alert-tooltip"
						className="cursor-help transition-transform hover:scale-110"
					>
						{getIconForField("playAudioAlert")}
					</span>
					<Tooltip
						id="audio-alert-tooltip"
						content={tooltipInformation.playAudioAlert}
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
			</div>
		</div>
	);
};