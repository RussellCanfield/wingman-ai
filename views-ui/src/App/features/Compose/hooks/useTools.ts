import type { ComposerState, ToolMessage } from "@shared/types/Composer";
import { useMemo } from "react";

export const useTools = (state: ComposerState) => {
	const toolMap: Map<string, ToolMessage[]> = useMemo(() => {
		const map: Map<string, ToolMessage[]> = new Map();

		for (const msg of state.messages) {
			if (msg.role === "tool") {
				const message = msg as ToolMessage;

				if (map.has(message.toolCallId)) {
					const existingMessages = map.get(message.toolCallId)!;
					existingMessages.push(message);
				} else {
					map.set(message.toolCallId, [message]);
				}
			}
		}

		return map;
	}, [state]);

	return {
		toolMap,
	};
};
