export const handleAutoResize = (
	element: HTMLTextAreaElement,
	reset = false,
	maxHeight = 128, // Default max height of 128px
) => {
	if (!element) return;

	if (reset) {
		// Reset the height to its default value
		element.style.height = "42px"; // Minimum/default height
		element.style.overflowY = "hidden";
		return;
	}

	// Reset height to auto to get the correct scrollHeight
	element.style.height = "auto";

	// Set the height to either the scrollHeight or the minimum height, but not exceeding maxHeight
	const newHeight = Math.min(Math.max(element.scrollHeight, 42), maxHeight);
	element.style.height = `${newHeight}px`;

	// Add overflow-y scrolling if content exceeds maxHeight
	element.style.overflowY =
		element.scrollHeight > maxHeight ? "auto" : "hidden";
};
