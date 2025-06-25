import { useCallback } from "react";
import { useInput } from "ink";
import os from "node:os";
import { useWingman } from "../contexts/WingmanContext";

export function useHotkeys() {
	const { toggleContextView, clearContext } = useWingman();
	const isMac = os.platform() === "darwin";

	useInput(
		useCallback(
			(inputChar, key) => {
				const modifierPressed = isMac ? key.meta : key.ctrl;

				// Only handle hotkeys, not general input
				if (!modifierPressed) {
					return;
				}

				const char = inputChar.toLowerCase();

				if (char === "b") {
					toggleContextView();
				} else if (char === "d") {
					clearContext();
				}
			},
			[isMac, toggleContextView, clearContext],
		),
	);
}
