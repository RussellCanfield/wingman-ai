import React, { useRef, useState } from "react";
import { FileSearchResult } from "@shared/types/Composer";

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
		? "bg-white border-slate-300"
		: "bg-slate-700 border-slate-600";
	const dropdownItemClasses = isLightTheme
		? "hover:bg-slate-100"
		: "hover:bg-slate-600";
	const captionClasses = isLightTheme ? "text-stone-500" : "text-stone-400";

	const truncatePath = (path: string, maxLength: number = 50) => {
		if (path.length <= maxLength) return path;
		return "..." + path.slice(-maxLength);
	};

	if (!showDropdown || dropdownItems.length === 0) {
		return null;
	}

	return (
		<div
			ref={dropdownRef}
			className={`absolute bottom-[8rem] mb-1 left-0 w-full z-20 ${dropdownClasses} border rounded overflow-y-auto max-h-[512px]`}
		>
			{dropdownItems.map((item, index) => (
				<div
					key={index}
					className={`p-2 cursor-pointer hover:text-white ${dropdownItemClasses} ${
						index === focusedDropdownIndex
							? "bg-slate-600 text-white"
							: ""
					}`}
					onClick={() => onSelect(item)}
				>
					<div>{item.file}</div>
					<div className={`text-xs ${captionClasses}`}>
						{truncatePath(item.path)}
					</div>
				</div>
			))}
		</div>
	);
};
