import { useEffect, useRef } from "react";

export function useAutoFocus(): React.RefObject<HTMLTextAreaElement> {
	const textAreaRef = useRef<HTMLTextAreaElement>(null);

	useEffect(() => {
		if (textAreaRef.current) {
			textAreaRef.current.focus();
		}
	}, []);

	return textAreaRef;
}
