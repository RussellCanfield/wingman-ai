export const handleAutoResize = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
	const textarea = e.target;

	// Reset height to auto to get the correct scrollHeight
	textarea.style.height = "auto";

	// Set the height to either the scrollHeight or the minimum height
	const newHeight = Math.max(textarea.scrollHeight, 36); // 36px is your current minHeight
	textarea.style.height = `${newHeight}px`;
};
