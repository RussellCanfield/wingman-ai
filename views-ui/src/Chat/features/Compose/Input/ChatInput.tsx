import React, { useEffect, useRef, useState } from "react";
import { FaPlay, FaStopCircle, FaPaperclip } from "react-icons/fa";
import { vscode } from "../../../utilities/vscode";
import { AppMessage } from "@shared/types/Message";
import { FileSearchResult } from "@shared/types/Composer";
import { useAutoFocus } from "../../../hooks/useAutoFocus";
import { useOnScreen } from "../../../hooks/useOnScreen";
import { handleAutoResize } from "../../../utilities/utils";
import { FileDropdown } from "./components/FileDropdown";
import { FileChips } from "./components/FileChips";
import { ImagePreview } from "./components/ImagePreview";
import { useSettingsContext } from "../../../context/settingsContext";
import { useComposerContext } from "../../../context/composerContext";

interface ChatInputProps {
	onChatSubmitted: (
		input: string,
		contextFiles: string[],
		image?: File
	) => void;
	onChatCancelled: () => void;
	loading: boolean;
}

const ChatInput = ({
	loading,
	onChatSubmitted,
	onChatCancelled,
}: ChatInputProps) => {
	const [ref, isVisible] = useOnScreen();
	const { isLightTheme } = useSettingsContext();
	const { activeFiles, setActiveFiles } = useComposerContext();
	const [inputValue, setInputValue] = useState("");
	const [selectedImage, setSelectedImage] = useState<File | null>(null);
	const [imagePreview, setImagePreview] = useState<string | null>(null);
	const chatInputBox = useAutoFocus();
	const fileInputRef = useRef<HTMLInputElement>(null);
	const [showDropdown, setShowDropdown] = useState(false);
	const [focusedDropdownIndex, setFocusedDropdownIndex] = useState<number>(1);
	const [allDropdownItems, setDropdownItems] = useState<FileSearchResult[]>(
		[]
	);
	const [inputRect, setInputRect] = useState<DOMRect | null>(null);

	useEffect(() => {
		if (isVisible) {
			chatInputBox.current?.focus();
		}
	}, [isVisible]);

	useEffect(() => {
		if (chatInputBox.current) {
			const rect = chatInputBox.current.getBoundingClientRect();
			setInputRect(rect);
		}
	}, [inputValue, activeFiles]);

	const handleResponse = (event: MessageEvent<AppMessage>) => {
		const { data } = event;
		const { command, value } = data;

		switch (command) {
			case "get-files-result":
				if (!value) {
					return;
				}

				const fileResults = value as FileSearchResult[];
				setDropdownItems(fileResults);
				setFocusedDropdownIndex(0);
				setShowDropdown(fileResults.length > 0);
				break;
		}
	};

	useEffect(() => {
		window.addEventListener("message", handleResponse);
		window.addEventListener("paste", handlePaste);

		return () => {
			window.removeEventListener("message", handleResponse);
			window.removeEventListener("paste", handlePaste);
		};
	}, []);

	const handlePaste = (e: ClipboardEvent) => {
		const items = e.clipboardData?.items;
		if (!items) return;

		//@ts-expect-error
		for (const item of items) {
			if (item.type.startsWith("image/")) {
				const file = item.getAsFile();
				if (file) {
					handleImageSelect(file);
				}
				break;
			}
		}
	};

	const handleImageSelect = (file: File) => {
		if (!file.type.startsWith("image/")) {
			return;
		}
		setSelectedImage(file);
		const reader = new FileReader();
		reader.onloadend = () => {
			setImagePreview(reader.result as string);
		};
		reader.readAsDataURL(file);
	};

	const handleImageUpload = () => {
		fileInputRef.current?.click();
	};

	const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
		const file = e.target.files?.[0];
		if (file) {
			handleImageSelect(file);
		}
	};

	const removeImage = () => {
		setSelectedImage(null);
		setImagePreview(null);
		if (fileInputRef.current) {
			fileInputRef.current.value = "";
		}
	};

	const chipMap = new Set(activeFiles.map((chip) => chip.path));
	const filteredDropDownItems = allDropdownItems.filter(
		(d) => !chipMap.has(d.path)
	);

	const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
		const value = e.target.value;
		setInputValue(value);

		const lastWord = value.split(/\s+/).pop() || "";
		if (lastWord.startsWith("@")) {
			const searchTerm = lastWord.slice(1);
			fetchFiles(searchTerm);
		} else {
			setShowDropdown(false);
		}
	};

	const handleDropdownSelect = (item: FileSearchResult) => {
		if (!item) return;

		if (!activeFiles.some((chip) => chip.path === item.path)) {
			const newChips = [...activeFiles, item];
			setActiveFiles(newChips);

			const words = inputValue.split(/\s+/);
			words.pop();
			setInputValue(words.join(" ") + (words.length > 0 ? " " : ""));
		}

		setShowDropdown(false);
		setFocusedDropdownIndex(0);
		chatInputBox.current?.focus();
	};

	const handleChipRemove = (chip: FileSearchResult) => {
		setActiveFiles(activeFiles.filter((c) => c !== chip));
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
					activeFiles.map((chip) => `@${chip.file}`).join(" ") +
					(activeFiles.length > 0 && inputValue ? " " : "") +
					inputValue;

				if (message.trim() || selectedImage) {
					onChatSubmitted(
						inputValue.trim(),
						activeFiles.map((chip) => chip.path),
						selectedImage || undefined
					);
					setInputValue("");
					removeImage();
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

	const fetchFiles = (filter: string) => {
		vscode.postMessage({
			command: "get-files",
			value: filter,
		});
	};

	return (
		<>
			<div
				className="flex-basis-50 py-3 flex flex-col items-stretch"
				ref={ref}
			>
				<div className="relative flex flex-col items-stretch">
					{imagePreview && (
						<ImagePreview
							imageUrl={imagePreview}
							onRemove={removeImage}
						/>
					)}
					<FileChips
						chips={activeFiles}
						onChipRemove={handleChipRemove}
						isLightTheme={isLightTheme}
					/>
					<div className="flex flex-wrap items-center mb-2 border-2 border-gray-500 rounded-md">
						<textarea
							placeholder={
								activeFiles.length === 0
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
							className="flex-grow resize-none text-[var(--vscode-input-foreground)] focus:outline-none bg-transparent border-b-2 border-stone-600 overflow-y-auto min-h-[36px] p-2"
							style={{ minHeight: "36px", outline: "none" }}
							onKeyDown={handleUserInput}
						/>
						<div className="flex w-full justify-between">
							<input
								type="file"
								ref={fileInputRef}
								onChange={handleFileChange}
								accept="image/*"
								className="hidden"
							/>
							<span className="p-4 pr-2">
								<FaPaperclip
									size={16}
									className="cursor-pointer text-gray-400 hover:text-gray-100"
									onClick={handleImageUpload}
									title="Attach image"
								/>
							</span>
							<span className="p-4 pr-2">
								{!loading && (
									<FaPlay
										size={16}
										tabIndex={0}
										role="presentation"
										title="Send"
										className={`${!inputValue.trim()
												? "text-gray-500"
												: "text-gray-100"
											} cursor-pointer`}
										onClick={() =>
											handleUserInput({
												key: "Enter",
												preventDefault: () => { },
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
					{showDropdown &&
						filteredDropDownItems.length > 0 &&
						inputRect && (
							<FileDropdown
								dropdownItems={filteredDropDownItems}
								onSelect={handleDropdownSelect}
								isLightTheme={isLightTheme}
								showDropdown={showDropdown}
								focusedDropdownIndex={focusedDropdownIndex}
							/>
						)}
				</div>
			</div>
		</>
	);
};

export { ChatInput };
