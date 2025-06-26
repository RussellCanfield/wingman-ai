import { v4 as uuidv4 } from "uuid";
import type { WingmanAction, WingmanState, Message } from "./types";
import { Status } from "./types";

export const initialState: WingmanState = {
	messages: [],
	status: Status.Idle,
	input: "",
	inputTokens: 0,
	outputTokens: 0,
	model: "",
	contextFiles: [],
	contextDirectories: [],
	isContextViewExpanded: false,
	summary: null,
	currentAiMessageId: null,
};

export function wingmanReducer(
	state: WingmanState,
	action: WingmanAction,
): WingmanState {
	switch (action.type) {
		case "SET_STATUS":
			return { ...state, status: action.payload };
		case "SET_INPUT":
			return {
				...state,
				input:
					typeof action.payload === "function"
						? action.payload(state.input)
						: action.payload,
			};
		case "SET_MODEL":
			return { ...state, model: action.payload };
		case "ADD_MESSAGE":
			return { ...state, messages: [...state.messages, action.payload] };
		case "UPDATE_LAST_MESSAGE": {
			const newMessages = [...state.messages];
			const lastMessage = newMessages[newMessages.length - 1];
			if (lastMessage) {
				lastMessage.content += action.payload.content;
			}
			return { ...state, messages: newMessages };
		}
		case "UPDATE_TOOL_CALL_MESSAGE": {
			return {
				...state,
				messages: state.messages.map((m) => {
					if (m.id === action.payload.tool_call_id) {
						return {
							...m,
							content: action.payload.content,
							toolStatus: "finished",
						};
					}
					return m;
				}),
			};
		}
		case "ADD_TOKENS":
			return {
				...state,
				inputTokens: state.inputTokens + action.payload.input,
				outputTokens: state.outputTokens + action.payload.output,
			};
		case "ADD_CONTEXT_FILES":
			return {
				...state,
				contextFiles: [
					...new Set([...state.contextFiles, ...action.payload]),
				],
			};
		case "ADD_CONTEXT_DIRECTORIES":
			return {
				...state,
				contextDirectories: [
					...new Set([...state.contextDirectories, ...action.payload]),
				],
			};
		case "TOGGLE_CONTEXT_VIEW":
			return { ...state, isContextViewExpanded: !state.isContextViewExpanded };
		case "CLEAR_CONTEXT":
			return { ...state, contextFiles: [], contextDirectories: [] };
		case "COMPACT":
			return {
				...state,
				messages: [],
				inputTokens: 0,
				outputTokens: 0,
				summary: action.payload,
			};
		case "SET_CURRENT_AI_MESSAGE_ID":
			return { ...state, currentAiMessageId: action.payload };
		case "HANDLE_AI_MESSAGE": {
			const { message } = action.payload;
			let newMessages = [...state.messages];
			let newStatus = state.status;
			let newCurrentAiMessageId = state.currentAiMessageId;

			if (message.tool_calls && message.tool_calls.length > 0) {
				const existingToolCallIds = new Set(
					state.messages.filter((m) => m.type === "tool").map((m) => m.id),
				);
				const toolCalls = message.tool_calls ?? [];
				const newToolCallMessages: Message[] = toolCalls
					.filter((tc) => tc.id && !existingToolCallIds.has(tc.id))
					.map((toolCall) => ({
						id: toolCall.id!,
						type: "tool",
						toolName: toolCall.name,
						args: toolCall.args,
						content: "",
						toolStatus: "executing",
					}));

				if (newToolCallMessages.length > 0) {
					newStatus = Status.ExecutingTool;
					newMessages = [...newMessages, ...newToolCallMessages];
				}
			}

			if (
				message.content &&
				typeof message.content === "string" &&
				message.content.trim()
			) {
				if (!state.currentAiMessageId) {
					const newAiMessage: Message = {
						id: uuidv4(),
						type: "ai",
						content: message.content,
						tokenCount: message.usage_metadata?.total_tokens,
					};
					newCurrentAiMessageId = newAiMessage.id;
					newMessages.push(newAiMessage);
				} else {
					const lastMessage = newMessages.find(
						(m) => m.id === state.currentAiMessageId,
					);
					if (lastMessage) {
						lastMessage.content = message.content as string;
						if (message.usage_metadata) {
							lastMessage.tokenCount =
								(lastMessage.tokenCount || 0) +
								message.usage_metadata.total_tokens;
						}
					}
				}
			}

			return {
				...state,
				messages: newMessages,
				status: newStatus,
				currentAiMessageId: newCurrentAiMessageId,
			};
		}
		case "HANDLE_TOOL_MESSAGE": {
			const { message } = action.payload;
			return {
				...state,
				status: Status.Thinking,
				messages: state.messages.map((m) => {
					if (m.id === message.tool_call_id) {
						return {
							...m,
							content: message.content as string,
							toolStatus: "finished",
						};
					}
					return m;
				}),
			};
		}
		default:
			return state;
	}
}
