import { v4 as uuidv4 } from "uuid";
import type { WingmanAction, WingmanState, Message } from "./types";
import { Status } from "./types";
import { reducerLogger } from "../utils/logger";

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
	const startTime = Date.now();

	reducerLogger.debug(
		{
			event: "action_dispatch",
			action: action.type,
			//@ts-expect-error
			payload: action.payload,
		},
		`Dispatching action: ${action.type}`,
	);

	let newState: WingmanState;

	switch (action.type) {
		case "SET_STATUS": {
			const prevStatus = state.status;
			newState = { ...state, status: action.payload };

			reducerLogger.info(
				{
					event: "status_change",
					from: Status[prevStatus],
					to: Status[action.payload],
					fromValue: prevStatus,
					toValue: action.payload,
				},
				`Status changed: ${Status[prevStatus]} → ${Status[action.payload]}`,
			);
			break;
		}

		case "SET_INPUT": {
			const prevInput = state.input;
			newState = {
				...state,
				input:
					typeof action.payload === "function"
						? action.payload(state.input)
						: action.payload,
			};

			reducerLogger.trace(
				{
					event: "input_change",
					prevLength: prevInput.length,
					newLength: newState.input.length,
					isFunction: typeof action.payload === "function",
				},
				"Input value changed",
			);
			break;
		}

		case "SET_MODEL": {
			newState = { ...state, model: action.payload };

			reducerLogger.info(
				{
					event: "model_change",
					model: action.payload,
				},
				`Model set to: ${action.payload}`,
			);
			break;
		}

		case "ADD_MESSAGE": {
			newState = { ...state, messages: [...state.messages, action.payload] };

			reducerLogger.info(
				{
					event: "message_added",
					messageType: action.payload.type,
					messageId: action.payload.id,
					contentLength: action.payload.content?.length || 0,
					totalMessages: newState.messages.length,
				},
				`Added ${action.payload.type} message`,
			);
			break;
		}

		case "UPDATE_LAST_MESSAGE": {
			const newMessages = [...state.messages];
			const lastMessage = newMessages[newMessages.length - 1];
			if (lastMessage) {
				const prevLength = lastMessage.content?.length || 0;
				lastMessage.content += action.payload.content;

				reducerLogger.trace(
					{
						event: "message_updated",
						messageId: lastMessage.id,
						prevLength,
						newLength: lastMessage.content?.length || 0,
						addedLength: action.payload.content.length,
					},
					"Updated last message content",
				);
			}
			newState = { ...state, messages: newMessages };
			break;
		}

		case "UPDATE_TOOL_CALL_MESSAGE": {
			const updatedMessages = state.messages.map((m) => {
				if (m.id === action.payload.tool_call_id) {
					return {
						...m,
						content: action.payload.content,
						toolStatus: "finished" as const,
					};
				}
				return m;
			});

			newState = { ...state, messages: updatedMessages };

			reducerLogger.info(
				{
					event: "tool_call_completed",
					toolCallId: action.payload.tool_call_id,
					contentLength: action.payload.content.length,
				},
				"Tool call message updated",
			);
			break;
		}

		case "ADD_TOKENS": {
			newState = {
				...state,
				inputTokens: state.inputTokens + action.payload.input,
				outputTokens: state.outputTokens + action.payload.output,
			};

			reducerLogger.debug(
				{
					event: "tokens_added",
					inputTokens: action.payload.input,
					outputTokens: action.payload.output,
					totalInputTokens: newState.inputTokens,
					totalOutputTokens: newState.outputTokens,
				},
				`Added tokens: +${action.payload.input} input, +${action.payload.output} output`,
			);
			break;
		}

		case "ADD_CONTEXT_FILES": {
			const newFiles = [...new Set([...state.contextFiles, ...action.payload])];
			newState = { ...state, contextFiles: newFiles };

			reducerLogger.info(
				{
					event: "context_files_added",
					addedFiles: action.payload,
					totalFiles: newFiles.length,
					newFilesCount: action.payload.length,
				},
				`Added ${action.payload.length} context files`,
			);
			break;
		}

		case "ADD_CONTEXT_DIRECTORIES": {
			const newDirs = [
				...new Set([...state.contextDirectories, ...action.payload]),
			];
			newState = { ...state, contextDirectories: newDirs };

			reducerLogger.info(
				{
					event: "context_directories_added",
					addedDirectories: action.payload,
					totalDirectories: newDirs.length,
					newDirectoriesCount: action.payload.length,
				},
				`Added ${action.payload.length} context directories`,
			);
			break;
		}

		case "TOGGLE_CONTEXT_VIEW": {
			newState = {
				...state,
				isContextViewExpanded: !state.isContextViewExpanded,
			};

			reducerLogger.debug(
				{
					event: "context_view_toggled",
					expanded: newState.isContextViewExpanded,
				},
				`Context view ${newState.isContextViewExpanded ? "expanded" : "collapsed"}`,
			);
			break;
		}

		case "CLEAR_CONTEXT": {
			newState = {
				...state,
				contextFiles: [],
				contextDirectories: [],
				isContextViewExpanded: false,
			};

			reducerLogger.info(
				{
					event: "context_cleared",
					clearedFiles: state.contextFiles.length,
					clearedDirectories: state.contextDirectories.length,
				},
				"Context cleared",
			);
			break;
		}

		case "COMPACT": {
			newState = {
				...state,
				messages: [],
				inputTokens: 0,
				outputTokens: 0,
				summary: action.payload,
			};

			reducerLogger.info(
				{
					event: "conversation_compacted",
					clearedMessages: state.messages.length,
					clearedInputTokens: state.inputTokens,
					clearedOutputTokens: state.outputTokens,
					summaryLength: action.payload?.length || 0,
				},
				"Conversation compacted with summary",
			);
			break;
		}

		case "SET_CURRENT_AI_MESSAGE_ID": {
			newState = { ...state, currentAiMessageId: action.payload };

			reducerLogger.trace(
				{
					event: "current_ai_message_changed",
					messageId: action.payload,
				},
				`Current AI message ID set to: ${action.payload || "null"}`,
			);
			break;
		}

		case "HANDLE_AI_MESSAGE": {
			const { message } = action.payload;
			const newMessages = [...state.messages];
			let newCurrentAiMessageId = state.currentAiMessageId;

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

					reducerLogger.debug(
						{
							event: "ai_message_created",
							messageId: newAiMessage.id,
							contentLength: message.content.length,
							tokenCount: message.usage_metadata?.total_tokens,
						},
						"Created new AI message",
					);
				} else {
					const lastMessage = newMessages.find(
						(m) => m.id === state.currentAiMessageId,
					);
					if (lastMessage) {
						const prevLength = lastMessage.content?.length || 0;
						lastMessage.content = message.content as string;
						if (message.usage_metadata) {
							lastMessage.tokenCount =
								(lastMessage.tokenCount || 0) +
								message.usage_metadata.total_tokens;
						}

						reducerLogger.trace(
							{
								event: "ai_message_updated",
								messageId: lastMessage.id,
								prevLength,
								newLength: lastMessage.content.length,
								tokenCount: lastMessage.tokenCount,
							},
							"Updated existing AI message",
						);
					}
				}
			}

			newState = {
				...state,
				messages: newMessages,
				currentAiMessageId: newCurrentAiMessageId,
			};
			break;
		}

		case "HANDLE_TOOL_MESSAGE": {
			const { message } = action.payload;
			const updatedMessages = state.messages.map((m) => {
				if (m.id === message.tool_call_id) {
					return {
						...m,
						content: message.content as string,
						toolStatus: "finished" as const,
					};
				}
				return m;
			});

			newState = {
				...state,
				status: Status.Thinking,
				messages: updatedMessages,
			};

			reducerLogger.info(
				{
					event: "tool_message_handled",
					toolCallId: message.tool_call_id,
					contentLength: (message.content as string)?.length || 0,
				},
				"Tool message processed, returning to thinking",
			);
			break;
		}

		case "ADD_TOOL_CALLS": {
			const { toolCalls } = action.payload;
			const existingToolCallIds = new Set(
				state.messages.filter((m) => m.type === "tool").map((m) => m.id),
			);

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
				newState = {
					...state,
					status: Status.ExecutingTool,
					messages: [...state.messages, ...newToolCallMessages],
				};

				reducerLogger.info(
					{
						event: "tool_calls_added",
						toolCallCount: newToolCallMessages.length,
						tools: newToolCallMessages.map((tc) => ({
							id: tc.id,
							name: tc.toolName,
						})),
					},
					`Added ${newToolCallMessages.length} executing tool calls`,
				);
			} else {
				newState = state;
			}
			break;
		}

		default:
			reducerLogger.warn(
				{
					event: "unknown_action",
					action: (action as any).type,
				},
				`Unknown action type: ${(action as any).type}`,
			);
			newState = state;
	}

	const duration = Date.now() - startTime;

	reducerLogger.debug(
		{
			event: "action_completed",
			action: action.type,
			duration,
			stateChanged: newState !== state,
		},
		`Action ${action.type} completed in ${duration}ms`,
	);

	return newState;
}
