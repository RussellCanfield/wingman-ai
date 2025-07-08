import type { BaseMessage } from "@langchain/core/messages";
import { Annotation, messagesStateReducer } from "@langchain/langgraph";
import type { BackgroundAgentStatus } from "../tools/background_agent";

export type WingmanGraphState = typeof GraphAnnotation.State;
export type WingmanBackgroundAgentTasks = Record<string, BackgroundAgentStatus>;

export const GraphAnnotation = Annotation.Root({
	messages: Annotation<BaseMessage[]>({
		reducer: (currentState, updateValue) =>
			messagesStateReducer(currentState, updateValue),
		default: () => [],
	}),
	backgroundAgentTasks: Annotation<WingmanBackgroundAgentTasks>({
		default: () => ({}),
		reducer: (currentState, updateValue) => ({
			...currentState,
			...updateValue,
		}),
	}),
});
