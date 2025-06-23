import { useEffect, useRef } from "react";

// It would be nice if css fit-content worked here :/
export function useAutoResizeTextArea(value: string) {
	const textAreaRef = useRef<HTMLTextAreaElement>(null);

	useEffect(() => {
		const textArea = textAreaRef.current;
		if (textArea) {
			// Reset height to auto to get the correct scrollHeight
			textArea.style.height = "auto";
			// Set the height to the scrollHeight
			const newHeight = Math.min(textArea.scrollHeight, 200); // Max height of 200px
			textArea.style.height = `${newHeight}px`;
		}
	}, [value]);

	return textAreaRef;
}
