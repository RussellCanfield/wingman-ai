import { useRef } from "react";
import { useInput } from "ink";
import { useWingman } from "../contexts/WingmanContext";

export function useHotkeys() {
	const { toggleContextView, clearContext, setInput } = useWingman();
	const hotkeyWasPressed = useRef(false);

	useInput((inputChar, key) => {
		if (key.ctrl || key.meta) {
			if (inputChar === "v") {
				hotkeyWasPressed.current = true;
				toggleContextView();
			} else if (inputChar === "k") {
				hotkeyWasPressed.current = true;
				clearContext();
			}
		}
	});

	const customSetInput = (value: string) => {
		if (hotkeyWasPressed.current) {
			// A hotkey was just pressed. We set the ref back to false
			// and ignore the current input change completely to prevent
			// the hotkey's character (e.g., 'v' or 'k') from appearing.
			hotkeyWasPressed.current = false;
			return;
		}
		setInput(value);
	};

	return { customSetInput };
}
