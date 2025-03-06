import type React from "react";
import { useRef } from "react";
import type { FileSearchResult } from "@shared/types/Composer";

interface FileDropdownProps {
	isLightTheme: boolean;
	showDropdown: boolean;
	dropdownItems: FileSearchResult[];
	focusedDropdownIndex: number;
	onSelect: (item: FileSearchResult) => void;
}

export const FileDropdown: React.FC<FileDropdownProps> = ({
	isLightTheme,
	showDropdown,
	dropdownItems,
	focusedDropdownIndex,
	onSelect,
}) => {
	const dropdownRef = useRef<HTMLDivElement>(null);

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

	const truncatePath = (path: string, maxLength = 50) => {
		if (path.length <= maxLength) return path;
		const parts = path.split('/');
		if (parts.length <= 2) return `...${path.slice(-maxLength)}`;

		const fileName = parts.pop() || '';
		const directory = parts.join('/');
		const availableLength = maxLength - fileName.length - 4; // 4 for ".../"

		return `...${directory.slice(-availableLength)}/${fileName}`;
	};

	if (!showDropdown || dropdownItems.length === 0) {
		return null;
	}

	return (
		<div
			ref={dropdownRef}
			className={`absolute bottom-[8rem] mb-1 left-0 w-full z-20 ${dropdownClasses} border rounded overflow-y-auto max-h-[512px] shadow-lg`}
		>
			{dropdownItems.map((item, index) => (
				<div
					// biome-ignore lint/suspicious/noArrayIndexKey: <explanation>
					key={index}
					className={`${dropdownItemClasses} ${index === focusedDropdownIndex ? selectedItemClasses : ''}`}
					onClick={() => onSelect(item)}
					onKeyDown={(e) => {
						if (e.key === 'Enter' || e.key === ' ') {
							e.preventDefault();
							onSelect(item);
						}
					}}
					aria-selected={index === focusedDropdownIndex}
				>
					<div className="font-medium">{item.file}</div>
					<div className="text-xs text-[var(--vscode-descriptionForeground)]">
						{truncatePath(item.path)}
					</div>
				</div>
			))}
		</div>
	);
};