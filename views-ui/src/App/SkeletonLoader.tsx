import "./SkeletonLoader.css";

export const SkeletonLoader = ({ isDarkTheme }: { isDarkTheme: boolean }) => {
	return (
		<div className={`${isDarkTheme ? 'loader-light' : 'loader-dark'}`} />
	);
};
