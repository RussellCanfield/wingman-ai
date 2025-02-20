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
	selectedIndex
}) => {
	if (!visible || commands.length === 0) return null;

	const dropdownClasses = isLightTheme
		? "bg-white border-stone-300"
		: "bg-stone-800 border-stone-600";

	const dropdownItemClasses = `
        p-2 cursor-pointer transition-colors duration-200
        ${isLightTheme
			? 'hover:bg-gray-100 active:bg-gray-200'
			: 'hover:bg-gray-600 active:bg-gray-700'
		}
    `;

	const selectedItemClasses = `
        ${isLightTheme
			? 'bg-gray-100 hover:bg-gray-100'
			: 'bg-gray-800 hover:bg-gray-600'
		}
        text-[var(--vscode-input-foreground)]
    `;

	return (
		<div
			className={`absolute ${dropdownClasses} left-0 bottom-[8rem] w-full z-20 border rounded overflow-y-auto max-h-[512px]`}
		>
			{commands.map((command, index) => (
				<div
					key={command.id}
					className={`${dropdownItemClasses} ${selectedIndex === index ? selectedItemClasses : ''}`}
					onClick={() => onCommandSelect(command)}
				>
					<div className="font-medium">{command.label}</div>
					{command.description && (
						<div className="text-xs text-[var(--vscode-descriptionForeground)]">
							{command.description}
						</div>
					)}
				</div>
			))}
		</div>
	);
};

export { CommandDropdown };