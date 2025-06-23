export const SkeletonLoader = ({ isDarkTheme }: { isDarkTheme: boolean }) => {
	return (
		<div
			className={`${
				isDarkTheme ? "bg-code-dark" : "bg-code-light"
			} rounded-lg overflow-hidden shadow-lg animate-pulse w-full`}
		>
			<div className="p-4">
				<div className="h-4 bg-stone-500 rounded mb-4 w-1/4"></div>
				<div className="h-12 bg-stone-500 rounded"></div>
			</div>
		</div>
	);
};
