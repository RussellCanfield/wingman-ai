import type {
	AIMessage,
	AIMessageChunk,
	BaseMessage,
	ToolMessage,
} from "@langchain/core/messages";

export enum Status {
	Idle = 0,
	Thinking = 1,
	ExecutingTool = 2,
	Compacting = 3,
}

export interface Message {
	id: string;
	type: "human" | "ai" | "tool";
	content: string;
	args?: Record<string, unknown>;
	toolName?: string;
	tokenCount?: number;
	toolStatus?: "executing" | "finished";
}

export interface WingmanState {
	messages: Message[];
	status: Status;
	input: string;
	inputTokens: number;
	outputTokens: number;
	model: string;
	contextFiles: string[];
	contextDirectories: string[];
	isContextViewExpanded: boolean;
	summary: string | null;
	currentAiMessageId: string | null;
}

export type WingmanAction =
	| { type: "SET_STATUS"; payload: Status }
	| { type: "SET_INPUT"; payload: string | ((prev: string) => string) }
	| { type: "SET_MODEL"; payload: string }
	| { type: "ADD_MESSAGE"; payload: Message }
	| {
			type: "UPDATE_LAST_MESSAGE";
			payload: {
				content: string;
				usage_metadata?: { input_tokens: number; output_tokens: number };
			};
	  }
	| {
			type: "UPDATE_TOOL_CALL_MESSAGE";
			payload: { tool_call_id: string; content: string };
	  }
	| {
			type: "ADD_TOKENS";
			payload: { input: number; output: number };
	  }
	| { type: "ADD_CONTEXT_FILES"; payload: string[] }
	| { type: "ADD_CONTEXT_DIRECTORIES"; payload: string[] }
	| { type: "TOGGLE_CONTEXT_VIEW" }
	| { type: "CLEAR_CONTEXT" }
	| { type: "COMPACT"; payload: string }
	| { type: "SET_CURRENT_AI_MESSAGE_ID"; payload: string | null }
	| {
			type: "HANDLE_AI_MESSAGE";
			payload: {
				message: AIMessageChunk | AIMessage;
			};
	  }
	| {
			type: "HANDLE_TOOL_MESSAGE";
			payload: {
				message: ToolMessage;
			};
	  };
