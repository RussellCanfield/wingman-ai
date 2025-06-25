import type { WingmanAction, WingmanState } from "./types";
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
		default:
			return state;
	}
}
