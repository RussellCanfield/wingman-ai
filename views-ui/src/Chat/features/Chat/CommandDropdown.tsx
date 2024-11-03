import React from "react";
import { Command } from "./types";

interface CommandDropdownProps {
	commands: Command[];
	onCommandSelect: (command: Command) => void;
	visible: boolean;
	isLightTheme: boolean;
	selectedIndex: number;
}

const CommandDropdown: React.FC<CommandDropdownProps> = ({
	commands,
	onCommandSelect,
	visible,
	isLightTheme,
	selectedIndex,
}) => {
	if (!visible) return null;

	const dropdownClasses = isLightTheme
		? "bg-white border-slate-300"
		: "bg-slate-700 border-slate-600";
	const dropdownItemClasses = isLightTheme
		? "hover:bg-slate-100"
		: "hover:bg-slate-600";

	return (
		<div
			className={`absolute ${dropdownClasses} left-2 bottom-[6rem] z-50 bg-[var(--vscode-input-background)] border border-[var(--vscode-input-border)] rounded-md shadow-lg`}
			style={{
				minWidth: "200px",
			}}
		>
			<ul className="py-1">
				{commands.map((command, index) => (
					<li
						key={command.id}
						className={`${dropdownItemClasses} ${
							selectedIndex === index
								? "bg-[var(--vscode-list-hoverBackground)]"
								: ""
						} px-4 py-2 hover:bg-[var(--vscode-list-hoverBackground)] cursor-pointer`}
						onClick={() => onCommandSelect(command)}
					>
						<div className="flex items-center">
							<span className="font-medium">{command.id}</span>
							{command.description && (
								<span className="ml-2 text-sm text-[var(--vscode-descriptionForeground)]">
									{command.description}
								</span>
							)}
						</div>
					</li>
				))}
			</ul>
		</div>
	);
};

export { CommandDropdown };
