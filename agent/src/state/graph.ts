import type { BaseMessage } from "@langchain/core/messages";
import { Annotation, messagesStateReducer } from "@langchain/langgraph";

export type WingmanGraphState = typeof GraphAnnotation.State;

export const GraphAnnotation = Annotation.Root({
	messages: Annotation<BaseMessage[]>({
		reducer: (currentState, updateValue) => {
			const state = messagesStateReducer(currentState, updateValue);
			return state;
		},
		default: () => [],
	}),
});
