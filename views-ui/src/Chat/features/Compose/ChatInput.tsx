import React, { useEffect, useRef, useState } from "react";
import { FaPlay, FaStopCircle } from "react-icons/fa";
import { useAppContext } from "../../context";
import { vscode } from "../../utilities/vscode";
import { AppMessage } from "@shared/types/Message";
import { FileSearchResult } from "@shared/types/Composer";
import { useAutoFocus } from "../../hooks/useAutoFocus";
import { useOnScreen } from "../../hooks/useOnScreen";
import { handleAutoResize } from "../../utilities/utils";

interface ChatInputProps {
	onChatSubmitted: (input: string, contextFiles: string[]) => void;
	onChatCancelled: () => void;
	loading: boolean;
}

const ChatInput = ({
	loading,
	onChatSubmitted,
	onChatCancelled,
}: ChatInputProps) => {
	const [ref, isVisible] = useOnScreen();
	const { isLightTheme } = useAppContext();
	const [inputValue, setInputValue] = useState("");
	const chatInputBox = useAutoFocus();
	const dropdownRef = useRef<HTMLDivElement>(null);
	const [chips, setChips] = useState<FileSearchResult[]>([]);
	const [showDropdown, setShowDropdown] = useState(false);
	const [focusedDropdownIndex, setFocusedDropdownIndex] = useState<number>(1);
	const [allDropdownItems, setDropdownItems] = useState<FileSearchResult[]>(
		[]
	);

	const inputClasses = isLightTheme
		? "bg-white text-black border-slate-300"
		: "bg-stone-800 text-white border-stone-700";
	const dropdownClasses = isLightTheme
		? "bg-white border-slate-300"
		: "bg-slate-700 border-slate-600";
	const dropdownItemClasses = isLightTheme
		? "hover:bg-slate-100"
		: "hover:bg-slate-600";
	const chipClasses = isLightTheme
		? "bg-stone-800 text-white"
		: "bg-stone-700 text-white";
	const captionClasses = isLightTheme ? "text-stone-500" : "text-stone-400";

	useEffect(() => {
		if (isVisible) {
			chatInputBox.current?.focus();
		}
	}, [isVisible]);

	const handleResponse = (event: MessageEvent<AppMessage>) => {
		const { data } = event;
		const { command, value } = data;

		switch (command) {
			case "get-files-result":
				if (!value) {
					return;
				}

				const fileResults = value as FileSearchResult[];
				setFocusedDropdownIndex(0);
				setDropdownItems(fileResults);
				setShowDropdown(fileResults.length > 0);
				break;
		}
	};

	useEffect(() => {
		window.addEventListener("message", handleResponse);

		return () => {
			window.removeEventListener("message", handleResponse);
		};
	}, []);

	const chipMap = new Set(chips.map((chip) => chip.path));
	const filteredDropDownItems = allDropdownItems.filter(
		(d) => !chipMap.has(d.path)
	);

	const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
		const value = e.target.value;
		setInputValue(value);

		const lastWord = value.split(/\s+/).pop() || "";
		if (lastWord.startsWith("@")) {
			const searchTerm = lastWord.slice(1).toLowerCase();
			fetchFiles(searchTerm);
		} else {
			setShowDropdown(false);
		}
	};

	const handleDropdownSelect = (item: FileSearchResult) => {
		if (!chips.some((chip) => chip.path === item.path)) {
			const newChips = [...chips, item];
			setChips(newChips);

			// Remove the partial chip text
			const words = inputValue.split(/\s+/);
			words.pop(); // Remove the last word (partial chip)
			setInputValue(words.join(" ") + (words.length > 0 ? " " : "")); // Add a space if there's text left
		}

		setShowDropdown(false);
		setFocusedDropdownIndex(0);
		chatInputBox.current?.focus();
	};

	const handleChipRemove = (chip: FileSearchResult) => {
		setChips(chips.filter((c) => c !== chip));
	};

	const handleUserInput = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
		if (!inputValue.trim() || loading) return;

		if (e.key === "Enter" && !e.shiftKey) {
			e.preventDefault();
			if (showDropdown && filteredDropDownItems.length > 0) {
				handleDropdownSelect(
					filteredDropDownItems[focusedDropdownIndex]
				);
				chatInputBox.current?.focus();
			} else {
				const message =
					chips.map((chip) => `@${chip.file}`).join(" ") +
					(chips.length > 0 && inputValue ? " " : "") +
					inputValue;

				if (message.trim()) {
					onChatSubmitted(
						inputValue.trim(),
						chips.map((chip) => chip.path)
					);
					setInputValue("");
					handleAutoResize(e.target as HTMLTextAreaElement, true);
				}
			}
		} else if (e.key === "ArrowDown") {
			e.preventDefault();
			setFocusedDropdownIndex((prevIndex) =>
				Math.min(prevIndex + 1, allDropdownItems.length - 1)
			);
		} else if (e.key === "ArrowUp") {
			e.preventDefault();
			setFocusedDropdownIndex((prevIndex) => Math.max(prevIndex - 1, 0));
		}
	};

	const truncatePath = (path: string, maxLength: number = 50) => {
		if (path.length <= maxLength) return path;
		return "..." + path.slice(-maxLength);
	};

	const fetchFiles = (filter: string) => {
		vscode.postMessage({
			command: "get-files",
			value: filter,
		});
	};

	return (
		<div
			className="flex-basis-50 py-3 flex flex-col items-stretch"
			ref={ref}
		>
			<div className="relative flex flex-row items-center">
				<div className={`w-full ${inputClasses} relative`}>
					{chips.length === 0 ? (
						<></>
					) : (
						<div className="flex flex-wrap items-center p-2">
							{chips.map((chip, index) => (
								<span
									key={index}
									className={`${chipClasses} rounded-sm px-2 py-1 m-1 inline-flex items-center hover:bg-stone-500`}
									title={chip.path}
								>
									{chip.file}
									<button
										className="ml-1 font-bold"
										onClick={() => handleChipRemove(chip)}
									>
										×
									</button>
								</span>
							))}
						</div>
					)}
					<div className="flex flex-wrap items-center p-2">
						<textarea
							placeholder={
								chips.length === 0
									? "Type here to begin, use '@' to search for files to add as context."
									: ""
							}
							value={inputValue}
							onChange={(e) => {
								handleInputChange(e);
								handleAutoResize(e.target);
							}}
							ref={chatInputBox}
							tabIndex={0}
							rows={1}
							autoFocus
							className="flex-grow bg-transparent outline-none resize-none focus:ring-2 focus:ring-stone-600 overflow-hidden h-auto p-1"
							style={{ minHeight: "36px", outline: "none" }}
							onKeyDown={handleUserInput}
						/>
					</div>
				</div>
				{showDropdown && (
					<div
						ref={dropdownRef}
						className={`absolute bottom-full mb-1 left-0 w-full z-20 ${dropdownClasses} border rounded`}
					>
						{allDropdownItems
							.filter((d) => !chipMap.has(d.path))
							.map((item, index) => (
								<div
									key={index}
									className={`p-2 cursor-pointer hover:text-white ${dropdownItemClasses} ${
										index === focusedDropdownIndex
											? "bg-slate-600 text-white"
											: ""
									}`}
									onClick={() => handleDropdownSelect(item)}
								>
									<div>{item.file}</div>
									<div
										className={`text-xs ${captionClasses}`}
									>
										{truncatePath(item.path)}
									</div>
								</div>
							))}
					</div>
				)}
				<span className="p-4">
					{!loading && (
						<FaPlay
							size={16}
							tabIndex={0}
							role="presentation"
							title="Send"
							className={`${
								!inputValue.trim()
									? "text-gray-500"
									: "text-gray-100"
							} cursor-pointer`}
							onClick={() =>
								handleUserInput({
									key: "Enter",
									preventDefault: () => {},
									shiftKey: false,
								} as React.KeyboardEvent<HTMLTextAreaElement>)
							}
						/>
					)}
					{loading && (
						<FaStopCircle
							size={16}
							tabIndex={0}
							role="presentation"
							title="Cancel compose"
							className="cursor-pointer"
							onClick={onChatCancelled}
						/>
					)}
				</span>
			</div>
		</div>
	);
};

export { ChatInput };
