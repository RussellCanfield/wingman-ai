export const handleAutoResize = (
	element: HTMLTextAreaElement,
	reset: boolean = false,
	maxHeight: number = 128 // Default max height of 128px
) => {
	// Reset height to auto to get the correct scrollHeight
	element.style.height = "auto";

	if (reset) {
		element.style.height = "36px"; // Minimum height
	} else {
		// Set the height to either the scrollHeight or the minimum height, but not exceeding maxHeight
		const newHeight = Math.min(
			Math.max(element.scrollHeight, 36),
			maxHeight
		);
		element.style.height = `${newHeight}px`;
	}

	// Add overflow-y scrolling if content exceeds maxHeight
	element.style.overflowY =
		element.scrollHeight > maxHeight ? "auto" : "hidden";
};
