import React from "react";
import { FaX } from "react-icons/fa6";
import { FileSearchResult } from "@shared/types/Composer";

interface FileChipsProps {
	chips: FileSearchResult[];
	onChipRemove: (chip: FileSearchResult) => void;
	isLightTheme: boolean;
}

export const FileChips: React.FC<FileChipsProps> = ({
	chips,
	onChipRemove,
	isLightTheme,
}) => {
	const chipClasses = isLightTheme
		? "bg-stone-800 text-white"
		: "bg-stone-700 text-white";

	if (chips.length === 0) {
		return null;
	}

	return (
		<div className="flex flex-wrap items-center p-2">
			{chips.map((chip, index) => (
				<span
					key={index}
					className={`${chipClasses} rounded-sm px-2 py-1 m-1 inline-flex items-center hover:bg-stone-500 relative group`}
					data-tooltip={chip.path}
				>
					{chip.file}
					<button
						className="ml-1 font-bold"
						onClick={() => onChipRemove(chip)}
					>
						<FaX />
					</button>
					<span className="invisible group-hover:visible absolute -top-8 left-1/2 -translate-x-1/2 px-2 py-1 bg-gray-900 text-white text-sm rounded-md whitespace-nowrap p-2">
						{chip.path}
					</span>
				</span>
			))}
		</div>
	);
};