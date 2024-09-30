import { useEffect, useRef } from "react";

export function useAutoFocus<T extends HTMLElement>(): React.RefObject<T> {
	const elementRef = useRef<T>(null);

	useEffect(() => {
		if (elementRef.current) {
			elementRef.current.focus();
		}
	}, []);

	return elementRef;
}
