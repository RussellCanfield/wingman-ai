type ScrollMetrics = {
	scrollHeight: number;
	scrollTop: number;
	clientHeight: number;
	threshold?: number;
};

export function shouldAutoScroll({
	scrollHeight,
	scrollTop,
	clientHeight,
	threshold = 40,
}: ScrollMetrics): boolean {
	const distanceFromBottom = scrollHeight - scrollTop - clientHeight;
	return distanceFromBottom <= threshold;
}
